/*
 * Mentions Input
 * Version 1.1
 * Written by: Kenneth Auchenberg (Podio)
 *
 * Using underscore.js
 */

(function ($, _, undefined) {

  // Browser detections
  var isIE = (!+"\v1"); //hack based on this: http://webreflection.blogspot.com/2009/01/32-bytes-to-know-if-your-browser-is-ie.html
  var isFirefox = navigator.userAgent.indexOf('Firefox') != -1;

  // Settings
  var KEY = { BACKSPACE:8, TAB:9, RETURN:13, ESC:27, LEFT:37, UP:38, RIGHT:39, DOWN:40, COMMA:188, SPACE:32, HOME:36, END:35 }; // Keys "enum"
  var defaultSettings = {
    triggerChar:'@',
    onDataRequest:$.noop,
    minChars:2,
    showAvatars:true,
    elastic:true,
    classes:{
      autoCompleteItemActive:"active"
    },
    templates:{
      wrapper:_.template('<div class="mentions-input-box"></div>'),
      autocompleteList:_.template('<div class="mentions-autocomplete-list"><ul></ul></div>'),
      autocompleteListItem:_.template('<li data-ref-id="<%= id %>" data-ref-type="<%= type %>" data-display="<%= display %>"><%= content %></li>'),
      autocompleteListItemAvatar:_.template('<img  src="<%= avatar %>" />'),
      autocompleteListItemIcon:_.template('<div class="icon <%= icon %>"></div>'),
      mentionsOverlay:_.template('<div class="mentions"><div></div></div>'),
      mentionItemSyntax:_.template('@[<%= value %>](<%= ref_type %>:<%= ref_id %>)'),
      mentionItemHighlight:_.template('<strong><span><%= value %></span></strong>')
    }
  };

  var utils = {
    htmlEncode:function (str) {
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\x22/g, '&quot;').replace(/\x27/g, '&#39;');
    },
    highlightTerm:function (value, term) {
      if (!term && !term.length) {
        return value;
      }
      return value.replace(new RegExp("(?![^&;]+;)(?!<[^<>]*)(" + term + ")(?![^<>]*>)(?![^&;]+;)", "gi"), "<b>$1</b>");
    },
    getCaretPosition:function (domNode) {

      if ('selectionStart' in domNode) {
        return domNode.selectionStart;
      }

      var start = 0, end = 0, normalizedValue, textInputRange, len, endRange;
      var range = document.selection.createRange();

      if (range && range.parentElement() == domNode) {
        len = domNode.value.length;

        normalizedValue = domNode.value.replace(/\r\n/g, "\n");
        textInputRange = domNode.createTextRange();
        textInputRange.moveToBookmark(range.getBookmark());
        endRange = domNode.createTextRange();
        endRange.collapse(false);
        if (textInputRange.compareEndPoints("StartToEnd", endRange) > -1) {
          start = end = len;
        } else {
          start = -textInputRange.moveStart("character", -len);
          start += normalizedValue.slice(0, start).split("\n").length - 1;
        }
      }

      return start;
    },
    setCaratPosition:function (domNode, caretPos) {
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
    }
  };

  var MentionsInput = function (input) {
    var settings;
    var elmInputBox, elmInputWrapper, elmAutocompleteList, elmWrapperBox, elmMentionsOverlay;
    var elmActiveAutoCompleteItem;
    var mentionsCollection = [];
    var inputBuffer = [];
    var currentCaretPosition = 0, startCaretPosition = 0;
    var startPosOffset = (isIE || isFirefox ? -2 : -1);

    function initTextarea() {
      elmInputBox = $(input);

      if (elmInputBox.attr('data-mentions-input') == 'true') {
        return;
      }

      elmInputWrapper = elmInputBox.parent();
      elmWrapperBox = $(settings.templates.wrapper());
      elmInputBox.wrapAll(elmWrapperBox);
      elmWrapperBox = elmInputWrapper.find('> div');

      elmInputBox.attr('data-mentions-input', 'true');
      elmInputBox.bind('keydown', onInputBoxKeyDown);
      elmInputBox.bind('keypress', onInputBoxKeyPress);
      elmInputBox.bind('input', onInputBoxInput);
      elmInputBox.bind('click', onInputBoxClick);

      if (settings.elastic) {
        elmInputBox.elastic();
      }
    }

    function initAutocomplete() {
      elmAutocompleteList = $(settings.templates.autocompleteList());
      elmAutocompleteList.appendTo(elmWrapperBox);
      elmAutocompleteList.delegate('li', 'click', onAutoCompleteItemClick);
    }

    function initMentionsOverlay() {
      elmMentionsOverlay = $(settings.templates.mentionsOverlay());
      elmMentionsOverlay.prependTo(elmWrapperBox);
    }

    function updateValues() {
      var syntaxMessage = getInputBoxValue();

      _.each(mentionsCollection, function (mention) {
        var textSyntax = settings.templates.mentionItemSyntax({ value:mention.value, ref_type:'contact', ref_id:mention.ref_id });
        syntaxMessage = syntaxMessage.replace(mention.value, textSyntax);
      });

      var mentionText = utils.htmlEncode(syntaxMessage);

      _.each(mentionsCollection, function (mention) {
        var textSyntax = settings.templates.mentionItemSyntax({ value:utils.htmlEncode(mention.value), ref_type:'contact', ref_id:mention.ref_id });
        var textHighlight = settings.templates.mentionItemHighlight({ value:utils.htmlEncode(mention.value) });

        mentionText = mentionText.replace(textSyntax, textHighlight);
      });

      mentionText = mentionText.replace(/\n/g, '<br />');
      mentionText = mentionText.replace(/ {2}/g, '&nbsp; ');

      elmInputBox.data('messageText', syntaxMessage);
      elmMentionsOverlay.find('div').html(mentionText);
    }

    function resetBufferAndUpdateCaretStartPosition() {
      inputBuffer = [];
      startCaretPosition = utils.getCaretPosition(elmInputBox.get(0));

    }

    function updateMentionsCollection() {
      var inputText = getInputBoxValue();

      mentionsCollection = _.reject(mentionsCollection, function (mention, index) {
        return !mention.value || inputText.indexOf(mention.value) == -1;
      });
      mentionsCollection = _.compact(mentionsCollection);
    }

    function getInputBoxValue() {
      return $.trim(elmInputBox.val());
    }

    function onAutoCompleteItemClick(e) {
      // Clear input buffer
      inputBuffer = [];

      var elmTarget = $(this);
      var currentMessage = getInputBoxValue();

      var mentionDisplayValue = elmTarget.attr('data-display');

      // Display value
      var start = currentMessage.substr(0, startPosOffset + startCaretPosition);
      var end = currentMessage.substr(currentCaretPosition, currentMessage.length);
      var startEndIndex = (start + mentionDisplayValue).length;

      var updatedMessageText = start + mentionDisplayValue + end;

      mentionsCollection.push({
        ref_id:elmTarget.attr('data-ref-id'),
        ref_type:elmTarget.attr('data-ref-type'),
        value:elmTarget.attr('data-display')
      });

      elmInputBox.val(updatedMessageText);

      // Set correct focus and selection
      var domInputBox = elmInputBox[0];

      utils.setCaratPosition(domInputBox, startEndIndex);

      elmInputBox.focus();

      // Mentions & syntax message
      updateValues();

      hideAutoComplete();

      return false;
    }

    function onInputBoxClick(e) {
      resetBufferAndUpdateCaretStartPosition();
    }

    function onInputBoxInput(e) {
      updateValues();
      updateMentionsCollection();
      hideAutoComplete();

      var triggerCharIndex = _.lastIndexOf(inputBuffer, settings.triggerChar);
      if (triggerCharIndex > -1) {
        var query = inputBuffer.slice(triggerCharIndex + 1).join('');
        _.defer( _.bind(doSearch, this, query));
      } else {
        startCaretPosition = utils.getCaretPosition(elmInputBox.get(0)) + 2;
      }
    }

    function onInputBoxKeyPress(e) {
      var typedValue = String.fromCharCode(e.which || e.keyCode);
      inputBuffer.push(typedValue);
    }

    function onInputBoxKeyDown(e) {

      var value = getInputBoxValue();
      currentCaretPosition = utils.getCaretPosition(elmInputBox.get(0));

      if (!value.length) {
        startCaretPosition = 0;
        currentCaretPosition = 0;
      }

      if (e.keyCode == KEY.LEFT || e.keyCode == KEY.RIGHT || e.keyCode == KEY.HOME || e.keyCode == KEY.END) {
        // This also matches HOME/END on OSX which is CMD+LEFT, CMD+RIGHT

        // Defer execution to ensure carat pos has changed after HOME/END keys
        _.defer(resetBufferAndUpdateCaretStartPosition);

        return;
      }

      if (e.keyCode == KEY.BACKSPACE) {
        inputBuffer = inputBuffer.slice(0, -1 + inputBuffer.length); // Can't use splice, not available in IE
        return;
      }

      if (!elmAutocompleteList.is(':visible')) {
        return true;
      }

      switch (e.keyCode) {
        case KEY.UP:
        case KEY.DOWN:
          var elmCurrentAutoCompleteItem = null;
          if (e.keyCode == KEY.DOWN) {
            if (elmActiveAutoCompleteItem && elmActiveAutoCompleteItem.length) {
              elmCurrentAutoCompleteItem = elmActiveAutoCompleteItem.next();
            } else {
              elmCurrentAutoCompleteItem = elmAutocompleteList.find('li').first();
            }
          } else {
            elmCurrentAutoCompleteItem = $(elmActiveAutoCompleteItem).prev();
          }

          if (elmCurrentAutoCompleteItem.length) {
            selectAutoCompleteItem(elmCurrentAutoCompleteItem);
          }

          return false;

        case KEY.RETURN:
        case KEY.TAB:
          if (elmActiveAutoCompleteItem && elmActiveAutoCompleteItem.length) {
            elmActiveAutoCompleteItem.click();
            return false;
          }

          break;
      }

      return true;
    }

    function hideAutoComplete() {
      elmActiveAutoCompleteItem = null;
      elmAutocompleteList.empty().hide();
    }

    function selectAutoCompleteItem(elmItem) {
      elmItem.addClass(settings.classes.autoCompleteItemActive);
      elmItem.siblings().removeClass(settings.classes.autoCompleteItemActive);

      elmActiveAutoCompleteItem = elmItem;
    }

    function populateDropdown(query, results) {
      elmAutocompleteList.show();

      // Filter items that has already been mentioned
      var mentionValues = _.pluck(mentionsCollection, 'value');
      results = _.reject(results, function (item) {
        return _.include(mentionValues, item.name);
      });

      if (!results.length) {
        hideAutoComplete();
        return;
      }

      elmAutocompleteList.empty();
      var elmDropDownList = $("<ul>").appendTo(elmAutocompleteList).hide();

      _.each(results, function (item) {
        var elmListItem = $(settings.templates.autocompleteListItem({
          'id':utils.htmlEncode(item.id),
          'display':utils.htmlEncode(item.name),
          'type':utils.htmlEncode(item.type),
          'content':utils.highlightTerm(utils.htmlEncode((item.name)), query)
        }));

        if (settings.showAvatars) {
          var elmIcon;

          if (item.avatar) {
            elmIcon = $(settings.templates.autocompleteListItemAvatar({ avatar:item.avatar }));
          } else {
            elmIcon = $(settings.templates.autocompleteListItemIcon({ icon:item.icon }));
          }
          elmIcon.prependTo(elmListItem);
        }
        elmListItem = elmListItem.appendTo(elmDropDownList);
      });

      elmAutocompleteList.show();
      elmDropDownList.show();
    }

    function doSearch(query) {
      if (query && query.length && query.length >= settings.minChars) {
        hideAutoComplete();
        requestData('search', query);
      }
    }

    function requestData(mode, query) {
      settings.onDataRequest(mode, query, function (responseData) {
        populateDropdown(query, responseData);
      });
    }

    // Public methods
    return {
      init:function (options) {
        settings = options;

        initTextarea();
        initAutocomplete();
        initMentionsOverlay();
      },

      val:function (callback) {
        if (!_.isFunction(callback)) {
          return;
        }

        var value = mentionsCollection.length ? elmInputBox.data('messageText') : getInputBoxValue();
        callback.call(this, value);
      },

      reset:function () {
        elmInputBox.val('');
        mentionsCollection = [];
        updateValues();
      },

      getMentions:function (callback) {
        if (!_.isFunction(callback)) {
          return;
        }

        callback.call(this, mentionsCollection);
      }
    };
  };

  $.fn.mentionsInput = function (method, settings) {

    if (typeof method === 'object' || !method) {
      settings = method;
    }

    if (!settings) {
      settings = {};
    }

    settings = _.defaults(settings, defaultSettings);
    var outerArguments = arguments;

    return this.each(function () {
      var instance = $.data(this, 'mentionsInput') || $.data(this, 'mentionsInput', new MentionsInput(this));

      if (_.isFunction(instance[method])) {
        return instance[method].apply(this, Array.prototype.slice.call(outerArguments, 1));

      } else if (typeof method === 'object' || !method) {
        return instance.init.call(this, settings);

      } else {
        $.error('Method ' + method + ' does not exist');
      }

    });
  };

})(jQuery, _);