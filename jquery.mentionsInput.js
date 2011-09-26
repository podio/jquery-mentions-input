/*
 * Mentions Input
 * Version 1.0
 * Written by: Kenneth Auchenberg (Podio)
 *
 * Using underscore.js
 */

(function($, _, undefined) {

  var KEY = { BACKSPACE: 8, TAB: 9, RETURN: 13, ESC: 27, LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, COMMA: 188, SPACE: 32 }; // Keys "enum"
  var defaultSettings = {
    minChars                      : 2,
    showAvatars                   : true,
    classes : {
      autoCompleteItemActive      : "active"
    },
    templates : {
      wrapper                     : _.template('<div class="mentions-input-box"></div>'),
      autocompleteList            : _.template('<div class="mentions-autocomplete-list"><ul></ul></div>'),
      autocompleteListItem        : _.template('<li data-id="<%= id %>"  data-display="<%= display %>"><%= content %></li>'),
      autocompleteListItemAvatar  : _.template('<img  src="<%= avatar %>" />'),
      autocompleteListItemIcon    : _.template('<div class="icon <%= icon %>"></div>'),
      mentionsOverlay             : _.template('<div class="mentions"><div></div></div>'),
      mentionItemSyntax           : _.template('@[<%= value %>](<%= ref_type %>:<%= ref_id %>)'),
      mentionItemHighlight        : _.template('<strong><span><%= value %></span></strong>')
    }
  };

  var utils = {
    htmlEncode : function(str) {
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\x22/g, '&quot;').replace(/\x27/g, '&#39;');
    },
    highlightTerm : function(value, term) {
      if (!term && !term.length) {
        return value;
      }
      return value.replace(new RegExp("(?![^&;]+;)(?!<[^<>]*)(" + term + ")(?![^<>]*>)(?![^&;]+;)", "gi"), "<b>$1</b>");
    }
  };

  $.fn.mentionsInput = function (method, settings) {

    if (typeof method === 'object' || ! method) {
      settings = method;
    }

    if (!settings) {
      settings = {};
    }

    settings = _.defaults(settings, defaultSettings);
    var outerArguments = arguments;

    return this.each(function () {
      var instance = $.data(this, 'mentionsInput') || $.data(this, 'mentionsInput', new $.mentionsInput(this));

      if (_.isFunction(instance[method])) {
        return instance[method].apply(this, Array.prototype.slice.call(outerArguments, 1));

      } else if (typeof method === 'object' || ! method) {
        return instance.init.call(this, settings);

      } else {
        $.error('Method ' + method + ' does not exist');
      }

    });
  };

  $.mentionsInput = function (input) {
    var exports;
    var settings;
    var elmInputBox, elmInputWrapper, elmAutocompleteList, elmWrapperBox, elmMentionsOverlay;
    var elmActiveAutoCompleteItem;
    var mentionsCollection = [];

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
      elmInputBox.elastic();
      elmInputBox.bind('keydown', onInputKeyDown);
      elmInputBox.bind('input', onTextInput);
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

      _.each(mentionsCollection, function(mention) {
        var textSyntax = settings.templates.mentionItemSyntax({ value: mention.value, ref_type: 'contact', ref_id : mention.ref_id });
        syntaxMessage = syntaxMessage.replace(mention.value, textSyntax);
      });

      var mentionText = utils.htmlEncode(syntaxMessage);
      
      _.each(mentionsCollection, function(mention) {
        var textSyntax = settings.templates.mentionItemSyntax({ value: utils.htmlEncode(mention.value), ref_type: 'contact', ref_id : mention.ref_id });
        var textHighlight = settings.templates.mentionItemHighlight({ value: utils.htmlEncode(mention.value) });

        mentionText = mentionText.replace(textSyntax, textHighlight);
      });

      mentionText = mentionText.replace(/\n/g, '<br />');
      mentionText = mentionText.replace(/ {2}/g, '&nbsp; ');

      elmInputBox.data('messageText', syntaxMessage);
      elmMentionsOverlay.find('div').html(mentionText);
    }

    function updateMentionsCollection() {
      var inputText = getInputBoxValue();
      _.each(mentionsCollection, function(mention, index) {
        if (!mention.value || inputText.indexOf(mention.value) == -1) {
          delete mentionsCollection[index];
          mentionsCollection = _.compact(mentionsCollection);
        }
      });
    }

    function getInputBoxValue() {
      return $.trim(elmInputBox.val());
    }

    function onAutoCompleteItemClick(e) {
      var elmTarget = $(this);
      var message = getInputBoxValue();

      // Display value
      var tokens = message.split(/@\s*/);
      tokens.pop();
      tokens.push(elmTarget.data('display'));
      tokens.push('');

      mentionsCollection.push({
        ref_id: elmTarget.data('id'),
        ref_type: 'contact',
        value: elmTarget.data('display')
      });

      var displayText = tokens.join('');
      elmInputBox.val(displayText);

      // Set correct focus and selection
      elmInputBox[0].selectionStart = displayText.length;
      elmInputBox[0].selectionEnd = displayText.length;
      elmInputBox.focus();

      // Mentions & syntax message
      updateValues();

      hideAutoComplete();

      return false;
    }
    
    function onTextInput(e) {
      var value = getInputBoxValue();

      updateValues();
      updateMentionsCollection();
      hideAutoComplete();

      var atSignIndex = value.search(/@\w+/);
      if (atSignIndex >= 0) {
        var tokens = value.split(/@\s*/);
        var text = tokens.pop();
        _.defer(doSearch.curry(text));
      }
    }

    function onInputKeyDown(e) {
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

      if (!results.length) {
        hideAutoComplete();
        return;
      }

      // Filter items that has already been mentioned
      var mentionValues = _.pluck(mentionsCollection, 'value');
      results = _.reject(results, function(item) {
        return _.include(mentionValues, item.name);
      });

      elmAutocompleteList.empty();
      var elmDropDownList = $("<ul>").appendTo(elmAutocompleteList).hide();

      _.each(results, function(item) {
        var elmListItem = $(settings.templates.autocompleteListItem({
          'id': utils.htmlEncode(item.id),
          'display': utils.htmlEncode(item.name),
          'content': utils.highlightTerm(utils.htmlEncode((item.name)), query)
        }));

        if (settings.showAvatars) {
          var elmIcon;

          if (item.avatar) {
            elmIcon = $(settings.templates.autocompleteListItemAvatar({ avatar: item.avatar }));
          } else {
            elmIcon = $(settings.templates.autocompleteListItemIcon({ icon: item.icon }));
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
      settings.onDataRequest(mode, query, function(responseData) {
        populateDropdown(query, responseData);
      });
    }

    // Public methods
    exports = {
      init : function(options) {
        settings = options;

        initTextarea();
        initAutocomplete();
        initMentionsOverlay();
      },

      val :function(callback) {
        if (!_.isFunction(callback)) {
          return;
        }

        var value = mentionsCollection.length ? elmInputBox.data('messageText') : getInputBoxValue();
        callback.call(this, value);
      },

      reset: function() {
        elmInputBox.val('');
        mentionsCollection = [];
        updateValues();
      },

      getMentions: function(callback) {
        if (!_.isFunction(callback)) {
          return;
        }

        callback.call(this, mentionsCollection);
      }

    };

    // Public methods
    return exports;

  };

})(jQuery, _);