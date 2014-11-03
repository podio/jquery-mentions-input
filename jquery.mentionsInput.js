/*
 * Mentions Input
 * Version 1.0.2
 * Written by: Kenneth Auchenberg (Podio)
 *
 * Using underscore.js
 *
 * License: MIT License - http://www.opensource.org/licenses/mit-license.php
 */

(function ($, _, undefined) {

  // Settings
  var KEY = { BACKSPACE : 8, TAB : 9, RETURN : 13, ESC : 27, LEFT : 37, UP : 38, RIGHT : 39, DOWN : 40, COMMA : 188, SPACE : 32, HOME : 36, END : 35 }; // Keys "enum"
  
  //Default settings
  var defaultSettings = {
    triggerChar   : '@', //Char that respond to event
    onDataRequest : $.noop, //Function where we can search the data
    minChars      : 2, //Minimum chars to fire the event
    showAvatars   : true, //Show the avatars
    elastic       : true, //Grow the textarea automatically
    classes       : { 
      autoCompleteItemActive : "active" //Classes to apply in each item
    },
    templates     : {
      wrapper                    : _.template('<div class="mentions-input-box"></div>'),
      autocompleteList           : _.template('<div class="mentions-autocomplete-list"></div>'),
      autocompleteListItem       : _.template('<li data-ref-id="<%= id %>" data-ref-type="<%= type %>" data-display="<%= display %>"><%= content %></li>'),
      autocompleteListItemAvatar : _.template('<img src="<%= avatar %>" />'),
      autocompleteListItemIcon   : _.template('<div class="icon <%= icon %>"></div>'),
      mentionsOverlay            : _.template('<div class="mentions"><div></div></div>'),
      mentionItemSyntax          : _.template('@[<%= value %>](<%= type %>:<%= id %>)'),
      mentionItemHighlight       : _.template('<strong><span><%= value %></span></strong>')
    }
  };

  //Class util
  var utils = {
	//Encodes the character with _.escape function (undersocre)
    htmlEncode       : function (str) {
      return _.escape(str);
    },
	//
    highlightTerm    : function (value, term) {
      if (!term && !term.length) {
        return value;
      }
      return value.replace(new RegExp("(?![^&;]+;)(?!<[^<>]*)(" + term + ")(?![^<>]*>)(?![^&;]+;)", "gi"), "<b>$1</b>");
    },
	//Sets the caret in a valid position
    setCaratPosition : function (domNode, caretPos) {
      if (domNode.createTextRange) {
        var range = domNode.createTextRange();
        range.move('character', caretPos);
        range.select();
      } else {
        if (domNode.selectionStart) {
          domNode.focus();
          domNode.setSelectionRange(caretPos, caretPos);
        } else {
          domNode.focus();
        }
      }
    },
	//Deletes the white spaces
    rtrim: function(string) {
      return string.replace(/\s+$/,"");
    }
  };

  //Main class of MentionsInput plugin
  var MentionsInput = function (settings) {

    var domInput, elmInputBox, elmInputWrapper, elmAutocompleteList, elmWrapperBox, elmMentionsOverlay, elmActiveAutoCompleteItem;
    var mentionsCollection = [];
    var autocompleteItemCollection = {};
    var inputBuffer = [];
    var currentDataQuery;

	//Mix the default setting with the users settings
    settings = $.extend(true, {}, defaultSettings, settings );

	//Initializes the text area target
    function initTextarea() {
      elmInputBox = $(domInput); //Get the text area target

	  //If the text area is already configured, return
      if (elmInputBox.attr('data-mentions-input') === 'true') {
        return;
      }

      elmInputWrapper = elmInputBox.parent(); //Get the DOM element parent
      elmWrapperBox = $(settings.templates.wrapper()); 
      elmInputBox.wrapAll(elmWrapperBox); //Wrap all the text area into the div elmWrapperBox
      elmWrapperBox = elmInputWrapper.find('> div.mentions-input-box'); //Obtains the div elmWrapperBox that now contains the text area

      elmInputBox.attr('data-mentions-input', 'true'); //Sets the attribute data-mentions-input to true -> Defines if the text area is already configured
      elmInputBox.bind('keydown', onInputBoxKeyDown); //Bind the keydown event to the text area
      elmInputBox.bind('keypress', onInputBoxKeyPress); //Bind the keypress event to the text area
      elmInputBox.bind('input', onInputBoxInput); //Bind the input event to the text area
      elmInputBox.bind('click', onInputBoxClick); //Bind the click event to the text area
      elmInputBox.bind('blur', onInputBoxBlur); //Bind the blur event to the text area

      // Elastic textareas, grow automatically
      if( settings.elastic ) {
        elmInputBox.elastic();
      }
    }

	//Initializes the autocomplete list, append to elmWrapperBox and delegate the mousedown event to li elements
    function initAutocomplete() {
      elmAutocompleteList = $(settings.templates.autocompleteList()); //Get the HTML code for the list
      elmAutocompleteList.appendTo(elmWrapperBox); //Append to elmWrapperBox element
      elmAutocompleteList.delegate('li', 'mousedown', onAutoCompleteItemClick); //Delegate the event
    }

	//Initializes the mentions' overlay
    function initMentionsOverlay() {
      elmMentionsOverlay = $(settings.templates.mentionsOverlay()); //Get the HTML code of the mentions' overlay
      elmMentionsOverlay.prependTo(elmWrapperBox); //Insert into elmWrapperBox the mentions overlay
    }

	//Updates the values of the main variables
    function updateValues() {
      var syntaxMessage = getInputBoxValue(); //Get the actual value of the text area

      _.each(mentionsCollection, function (mention) {
        var textSyntax = settings.templates.mentionItemSyntax(mention);
        syntaxMessage = syntaxMessage.replace(mention.value, textSyntax);
      });

      var mentionText = utils.htmlEncode(syntaxMessage); //Encode the syntaxMessage

      _.each(mentionsCollection, function (mention) {
        var formattedMention = _.extend({}, mention, {value: utils.htmlEncode(mention.value)});
        var textSyntax = settings.templates.mentionItemSyntax(formattedMention);
        var textHighlight = settings.templates.mentionItemHighlight(formattedMention);

        mentionText = mentionText.replace(textSyntax, textHighlight);
      });

      mentionText = mentionText.replace(/\n/g, '<br />'); //Replace the escape character for <br />
      mentionText = mentionText.replace(/ {2}/g, '&nbsp; '); //Replace the 2 preceding token to &nbsp; 

      elmInputBox.data('messageText', syntaxMessage); //Save the messageText to elmInputBox
      elmMentionsOverlay.find('div').html(mentionText); //Insert into a div of the elmMentionsOverlay the mention text
    }

	//Cleans the buffer
    function resetBuffer() {
      inputBuffer = [];
    }

	//Updates the mentions collection
    function updateMentionsCollection() {
      var inputText = getInputBoxValue(); //Get the actual value of text area

	  //Returns the values that doesn't match the condition
      mentionsCollection = _.reject(mentionsCollection, function (mention, index) {
        return !mention.value || inputText.indexOf(mention.value) == -1;
      });
      mentionsCollection = _.compact(mentionsCollection); //Delete all the falsy values of the array and return the new array
    }

	//Adds mention to mentions collections
    function addMention(mention) {

      var currentMessage = getInputBoxValue(); //Get the actual value of the text area

      // Using a regex to figure out positions
      var regex = new RegExp("\\" + settings.triggerChar + currentDataQuery, "gi");
      regex.exec(currentMessage); //Executes a search for a match in a specified string. Returns a result array, or null

      var startCaretPosition = regex.lastIndex - currentDataQuery.length - 1; //Set the star caret position
      var currentCaretPosition = regex.lastIndex; //Set the current caret position

      var start = currentMessage.substr(0, startCaretPosition);
      var end = currentMessage.substr(currentCaretPosition, currentMessage.length);
      var startEndIndex = (start + mention.value).length + 1;

      mentionsCollection.push(mention);//Add the mention to mentionsColletions

      // Cleaning before inserting the value, otherwise auto-complete would be triggered with "old" inputbuffer
      resetBuffer();
      currentDataQuery = '';
      hideAutoComplete();

      // Mentions and syntax message
      var updatedMessageText = start + mention.value + ' ' + end;
      elmInputBox.val(updatedMessageText); //Set the value to the txt area
      updateValues();

      // Set correct focus and selection
      elmInputBox.focus();
      utils.setCaratPosition(elmInputBox[0], startEndIndex);
    }

	//Gets the actual value of the text area without white spaces from the beginning and end of the value
    function getInputBoxValue() {
      return $.trim(elmInputBox.val());
    }

	//Takes the click event when the user select a item of the dropdown
    function onAutoCompleteItemClick(e) {
      var elmTarget = $(this); //Get the item selected
      var mention = autocompleteItemCollection[elmTarget.attr('data-uid')]; //Obtains the mention

      addMention(mention);

      return false;
    }

	//Takes the click event on text area
    function onInputBoxClick(e) {
      resetBuffer();
    }

	//Takes the blur event on text area
    function onInputBoxBlur(e) {
      hideAutoComplete();
    }

	//Takes the input event when users write or delete something
    function onInputBoxInput(e) {
      updateValues();
      updateMentionsCollection();

      var triggerCharIndex = _.lastIndexOf(inputBuffer, settings.triggerChar); //Returns the last match of the triggerChar in the inputBuffer
      if (triggerCharIndex > -1) { //If the triggerChar is present in the inputBuffer array
        currentDataQuery = inputBuffer.slice(triggerCharIndex + 1).join(''); //Gets the currentDataQuery
        currentDataQuery = utils.rtrim(currentDataQuery); //Deletes the whitespaces

        _.defer(_.bind(doSearch, this, currentDataQuery)); //Invoking the function doSearch ( Bind the function to this)
      }
    }

	//Takes the keypress event
    function onInputBoxKeyPress(e) {
      if(e.keyCode !== KEY.BACKSPACE) { //If the key pressed is not the backspace
        var typedValue = String.fromCharCode(e.which || e.keyCode); //Takes the string that represent this CharCode
        inputBuffer.push(typedValue); //Push the value pressed into inputBuffer
      }
    }

	//Takes the keydown event
    function onInputBoxKeyDown(e) {

      // This also matches HOME/END on OSX which is CMD+LEFT, CMD+RIGHT
      if (e.keyCode === KEY.LEFT || e.keyCode === KEY.RIGHT || e.keyCode === KEY.HOME || e.keyCode === KEY.END) {
        // Defer execution to ensure carat pos has changed after HOME/END keys then call the resetBuffer function
        _.defer(resetBuffer);

        // IE9 doesn't fire the oninput event when backspace or delete is pressed. This causes the highlighting
        // to stay on the screen whenever backspace is pressed after a highlighed word. This is simply a hack
        // to force updateValues() to fire when backspace/delete is pressed in IE9.
        if (navigator.userAgent.indexOf("MSIE 9") > -1) {
          _.defer(updateValues); //Call the updateValues function
        }

        return;
      }

	  //If the key pressed was the backspace
      if (e.keyCode === KEY.BACKSPACE) {
        inputBuffer = inputBuffer.slice(0, -1 + inputBuffer.length); // Can't use splice, not available in IE
        return;
      }

	  //If the elmAutocompleteList is hidden
      if (!elmAutocompleteList.is(':visible')) {
        return true;
      }

      switch (e.keyCode) {
        case KEY.UP: //If the key pressed was UP or DOWN
        case KEY.DOWN:
          var elmCurrentAutoCompleteItem = null;
          if (e.keyCode === KEY.DOWN) { //If the key pressed was DOWN
            if (elmActiveAutoCompleteItem && elmActiveAutoCompleteItem.length) { //If elmActiveAutoCompleteItem exits 
              elmCurrentAutoCompleteItem = elmActiveAutoCompleteItem.next(); //Gets the next li element in the list
            } else {
              elmCurrentAutoCompleteItem = elmAutocompleteList.find('li').first(); //Gets the first li element found
            }
          } else {
            elmCurrentAutoCompleteItem = $(elmActiveAutoCompleteItem).prev(); //The key pressed was UP and gets the previous li element
          }

          if (elmCurrentAutoCompleteItem.length) {
            selectAutoCompleteItem(elmCurrentAutoCompleteItem);
          }

          return false;

        case KEY.RETURN: //If the key pressed was RETURN or TAB
        case KEY.TAB:
          if (elmActiveAutoCompleteItem && elmActiveAutoCompleteItem.length) { //If the elmActiveAutoCompleteItem exists
            elmActiveAutoCompleteItem.trigger('mousedown'); //Calls the mousedown event
            return false;
          }

          break;
      }

      return true;
    }

	//Hides the autoomplete
    function hideAutoComplete() {
      elmActiveAutoCompleteItem = null;
      elmAutocompleteList.empty().hide();
    }

	//Selects the item in the autocomplete list
    function selectAutoCompleteItem(elmItem) {
      elmItem.addClass(settings.classes.autoCompleteItemActive); //Add the class active to item
      elmItem.siblings().removeClass(settings.classes.autoCompleteItemActive); //Gets all li elements in autocomplete list and remove the class active

      elmActiveAutoCompleteItem = elmItem; //Sets the item to elmActiveAutoCompleteItem
    }

	//Populates dropdown
    function populateDropdown(query, results) {
      elmAutocompleteList.show(); //Shows the autocomplete list

      // Filter items that has already been mentioned
	  var mentionValues = _.pluck(mentionsCollection, 'value');
      results = _.reject(results, function (item) {
        return _.include(mentionValues, item.name);
      });

      if (!results.length) { //If there are not elements hide the autocomplete list
        hideAutoComplete();
        return;
      }

      elmAutocompleteList.empty(); //Remove all li elements in autocomplete list
      var elmDropDownList = $("<ul>").appendTo(elmAutocompleteList).hide(); //Inserts a ul element to autocomplete div and hide it

      _.each(results, function (item, index) {
        var itemUid = _.uniqueId('mention_'); //Gets the item with unique id

        autocompleteItemCollection[itemUid] = _.extend({}, item, {value: item.name}); //Inserts the new item to autocompleteItemCollection

        var elmListItem = $(settings.templates.autocompleteListItem({
          'id'      : utils.htmlEncode(item.id),
          'display' : utils.htmlEncode(item.name),
          'type'    : utils.htmlEncode(item.type),
          'content' : utils.highlightTerm(utils.htmlEncode((item.name)), query)
        })).attr('data-uid', itemUid); //Inserts the new item to list

		//If the index is 0
        if (index === 0) {
          selectAutoCompleteItem(elmListItem);
        }

		//If show avatars is true
        if (settings.showAvatars) {
          var elmIcon;

		  //If the item has an avatar
          if (item.avatar) {
            elmIcon = $(settings.templates.autocompleteListItemAvatar({ avatar : item.avatar }));
          } else { //If not then we set an default icon
            elmIcon = $(settings.templates.autocompleteListItemIcon({ icon : item.icon }));
          }
          elmIcon.prependTo(elmListItem); //Inserts the elmIcon to elmListItem
        }
        elmListItem = elmListItem.appendTo(elmDropDownList); //Insets the elmListItem to elmDropDownList
      });

      elmAutocompleteList.show(); //Shows the elmAutocompleteList div
      elmDropDownList.show(); //Shows the elmDropDownList
    }

	//Search into data list passed as parameter
    function doSearch(query) {
	  //If the query is not null, undefined, empty and has the minimum chars
      if (query && query.length && query.length >= settings.minChars) {
		//Call the onDataRequest function and then call the populateDropDrown
        settings.onDataRequest.call(this, 'search', query, function (responseData) {
          populateDropdown(query, responseData);
        });
      } else { //If the query is null, undefined, empty or has not the minimun chars
        hideAutoComplete(); //Hide the autocompletelist
      }
    }

	//Resets the text area
    function resetInput() {
      elmInputBox.val('');
      mentionsCollection = [];
      updateValues();
    }

    // Public methods
    return {
      //Initializes the mentionsInput component on a specific element.
	  init : function (domTarget) {

        domInput = domTarget;

        initTextarea();
        initAutocomplete();
        initMentionsOverlay();
        resetInput();

		//If the autocomplete list has prefill mentions
        if( settings.prefillMention ) {
          addMention( settings.prefillMention );
        }

      },

	  //An async method which accepts a callback function and returns a value of the input field (including markup) as a first parameter of this function. This is the value you want to send to your server.
      val : function (callback) {
        if (!_.isFunction(callback)) {
          return;
        }

        callback.call(this, mentionsCollection.length ? elmInputBox.data('messageText') : getInputBoxValue());
      },

	  //Resets the text area value and clears all mentions
      reset : function () {
        resetInput();
      },

	  //An async method which accepts a callback function and returns a collection of mentions as hash objects as a first parameter.
      getMentions : function (callback) {
        if (!_.isFunction(callback)) {
          return;
        }

        callback.call(this, mentionsCollection);
      }
    };
  };

  //Main function to include into jQuery and initialize the plugin
  $.fn.mentionsInput = function (method, settings) {

    var outerArguments = arguments; //Gets the arguments

	//If method is not a function
    if (typeof method === 'object' || !method) {
      settings = method;
    }

    return this.each(function () {
      var instance = $.data(this, 'mentionsInput') || $.data(this, 'mentionsInput', new MentionsInput(settings));

      if (_.isFunction(instance[method])) {
        return instance[method].apply(this, Array.prototype.slice.call(outerArguments, 1));

      } else if (typeof method === 'object' || !method) {
        return instance.init.call(this, this);

      } else {
        $.error('Method ' + method + ' does not exist');
      }

    });
  };

})(jQuery, _);
