/*
 * Mentions Input
 * Version 1.5
 * Written by: Kenneth Auchenberg (Citrix Systems Inc)
 *
 * Using underscore.js
 *
 * License: MIT License - http://www.opensource.org/licenses/mit-license.php
 */

(function ($, _, undefined) {

  // Settings
  var KEY = { BACKSPACE : 8, TAB : 9, RETURN : 13, ESC : 27, LEFT : 37, UP : 38, RIGHT : 39, DOWN : 40, SPACE : 32, HOME : 36, END : 35 }; // Keys "enum"
  var defaultSettings = {
    triggerChar               : '@',
    onDataRequest             : $.noop,
    minChars                  : 2,
    showAvatars               : true,
    elastic                   : true,
    insertSpaceAfterMention   : false,
    resetOnInitialize         : false,
    templates                 : {
      wrapper                 : _.template('<div class="mentions-input-box"></div>'),
      mentionsOverlay         : _.template('<div class="mentions"><div></div></div>'),
      mentionItemSyntax       : _.template('@[<%= value %>](<%= type %>:<%= id %>)'),
      mentionItemHighlight    : _.template('<strong><span><%= value %></span></strong>')
    }
  };

  var utils = {
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

    rtrim: function(string) {
      return string.replace(/\s+$/,"");
    }
  };


  var MentionsInput = function (settings) {

    _.bindAll(this, 'onInputBoxKeyDown', 'onInputBoxKeyPress', 'onInputBoxInput', 'onInputBoxClick', 'onInputBoxBlur', 'resetBuffer', 'getMentions', 'val');

    this.elmInputWrapper  = null;
    this.elmWrapperBox  = null;
    this.elmMentionsOverlay = null;

    this.autoCompleter = null;
    this.mentionsCollection = [];
    this.inputBuffer = [];
    this.currentDataQuery = '';

    this.initialize.apply(this, arguments);
  };

  _.extend(MentionsInput.prototype, {

    initialize : function(settings, domTarget) {

      this.settings = $.extend(true, {}, defaultSettings, settings );

      this.elmInputBox = $(domTarget);

      this.initTextarea();
      this.initMentionsOverlay();
      this.initAutocomplete();

      if( this.settings.resetOnInitialize ) {
        this.resetInput();
      }

      if( this.settings.prefillMention ) {
        this.addMention( this.settings.prefillMention );
      }
    },

    initAutocomplete : function() {
      this.autoCompleter = new this.settings.autoCompleter();
      this.autoCompleter.initialize( this, this.elmWrapperBox );
    },

    initTextarea : function() {

      this.elmInputWrapper = this.elmInputBox.parent();
      this.elmWrapperBox = $( this.settings.templates.wrapper() );
      this.elmInputBox.wrapAll( this.elmWrapperBox );
      this.elmWrapperBox = this.elmInputWrapper.find('> div');

      this.elmInputBox.bind('keydown.mentionsInput', this.onInputBoxKeyDown);
      this.elmInputBox.bind('keypress.mentionsInput', this.onInputBoxKeyPress);
      this.elmInputBox.bind('input.mentionsInput', this.onInputBoxInput);
      this.elmInputBox.bind('click.mentionsInput', this.onInputBoxClick);
      this.elmInputBox.bind('blur.mentionsInput', this.onInputBoxBlur);

      // Elastic textareas, internal setting for the Dispora guys
      if( this.settings.elastic ) {
        this.elmInputBox.elastic();
      }
    },

    initMentionsOverlay : function() {
      this.elmMentionsOverlay = $( this.settings.templates.mentionsOverlay() );
      this.elmMentionsOverlay.prependTo( this.elmWrapperBox );
    },

    _doSearch: function(query) {
      var self = this;

      if (query && query.length && query.length >= this.settings.minChars) {
        this.autoCompleter.loading();

        this.settings.onDataRequest.call(this, 'search', query, function (responseData) {

          // Filter items that has already been mentioned
          var mentionValues = _.pluck(this.mentionsCollection, 'value');

          responseData = _.reject(responseData, function (item) {
            return _.include(mentionValues, item.name);
          });

          self.autoCompleter.populate(responseData, query);

        });
      } else {
        this.autoCompleter.hide();
      }
    },

    hideAutoComplete : function() {
      this.autoCompleter.hide();
    },

    updateValues: function() {
      var self = this;
      var syntaxMessage = this.getInputBoxValue();

      _.each(this.mentionsCollection, function (mention) {
        var textSyntax = self.settings.templates.mentionItemSyntax(mention);
        syntaxMessage = syntaxMessage.replace(mention.value, textSyntax);
      });

      var mentionText = _.escape( syntaxMessage );

      _.each(this.mentionsCollection, function (mention) {

        var formattedMention = _.extend({}, mention, {value: _.escape( mention.value )});
        var textSyntax = self.settings.templates.mentionItemSyntax(formattedMention);
        var textHighlight = self.settings.templates.mentionItemHighlight(formattedMention);

        mentionText = mentionText.replace(textSyntax, textHighlight);
      });

      mentionText = mentionText.replace(/\n/g, '<br />');
      mentionText = mentionText.replace(/ {2}/g, '&nbsp; ');

      this.messageText = syntaxMessage;
      this.elmMentionsOverlay.find('div').html(mentionText);
    },

    resetBuffer: function() {
      this.inputBuffer = [];
    },

    resetInput: function() {
      this.elmInputBox.val('');
      this.mentionsCollection = [];
      this.updateValues();
    },

    updateMentionsCollection: function() {
      var inputText = this.getInputBoxValue();

      this.mentionsCollection = _.reject(this.mentionsCollection, function (mention, index) {
        return !mention.value || inputText.indexOf(mention.value) == -1;
      });

      this.mentionsCollection = _.compact(this.mentionsCollection);
    },

    addMention: function(mention) {

      var currentMessage = this.getInputBoxValue();

      // Using a regex to figure out positions
      var regex = new RegExp("\\" + this.settings.triggerChar + currentDataQuery, "gi");
      regex.exec(currentMessage);

      var startCaretPosition = regex.lastIndex - currentDataQuery.length - 1;
      var currentCaretPosition = regex.lastIndex;

      var start = currentMessage.substr(0, startCaretPosition);
      var end = currentMessage.substr(currentCaretPosition, currentMessage.length);
      var startEndIndex = (start + mention.value).length;

      if( this.settings.insertSpaceAfterMention ) {
        startEndIndex = startEndIndex + 1;
      }

      this.mentionsCollection.push(mention);

      // Cleaning before inserting the value, otherwise auto-complete would be triggered with "old" inputbuffer
      this.currentDataQuery = '';
      this.resetBuffer();
      this.hideAutoComplete();

      // Mentions & syntax message
      var updatedMessageText = start + mention.value;
      if( this.settings.insertSpaceAfterMention ) {
        updatedMessageText = updatedMessageText+ ' ';
      }
      updatedMessageText = updatedMessageText + end;

      this.elmInputBox.val(updatedMessageText);
      this.updateValues();

      // Set correct focus and selection
      this.elmInputBox.focus();

      utils.setCaratPosition( this.elmInputBox[0], startEndIndex );
    },

    getInputBoxValue: function() {
      return this.elmInputBox.val();
    },

    // Event handlers
    onInputBoxClick: function(e) {
      this.resetBuffer();
    },

    onInputBoxBlur: function(e) {
      this.hideAutoComplete();
    },

    onInputBoxInput: function(e) {

      this.updateValues();
      this.updateMentionsCollection();
      this.hideAutoComplete();

      var triggerCharIndex = _.lastIndexOf( this.inputBuffer, this.settings.triggerChar );

      if (triggerCharIndex === 0) {
        currentDataQuery = this.inputBuffer.slice(triggerCharIndex + 1).join('');
        currentDataQuery = utils.rtrim(currentDataQuery);

        _.defer(_.bind( this._doSearch , this, currentDataQuery));
      }
    },

    onInputBoxKeyPress: function(e) {
      if(e.keyCode !== KEY.BACKSPACE) {
        var typedValue = String.fromCharCode(e.which || e.keyCode);
        this.inputBuffer.push(typedValue);
      }
    },

    onInputBoxKeyDown: function(e) {

      // This also matches HOME/END on OSX which is CMD+LEFT, CMD+RIGHT
      if (e.keyCode == KEY.LEFT || e.keyCode == KEY.RIGHT || e.keyCode == KEY.HOME || e.keyCode == KEY.END ) {
        // Defer execution to ensure carat pos has changed after HOME/END keys
        _.defer( this.resetBuffer );

        // IE9 doesn't fire the oninput event when backspace or delete is pressed. This causes the highlighting
        // to stay on the screen whenever backspace is pressed after a highlighed word. This is simply a hack
        // to force updateValues() to fire when backspace/delete is pressed in IE9.
        if (navigator.userAgent.indexOf("MSIE 9") > -1) {
          _.defer( this.updateValues );
        }

        return;
      }

      // Special handling for space, since we want to reset buffer on space, but only when autocompleter is hidden
      if ( e.keyCode == KEY.SPACE ) {

        if ( this.autoCompleter.isVisible() ) {
          // Allow spaces when autcompleter is visible
          return;
        }

        _.defer( this.resetBuffer );
      }

      if ( e.keyCode == KEY.RETURN ) {
        _.defer( this.resetBuffer );
      }

      if (e.keyCode == KEY.BACKSPACE) {
        this.inputBuffer = this.inputBuffer.slice(0, -1 + this.inputBuffer.length); // Can't use splice, not available in IE
        return;
      }

      if (e.keyCode == KEY.TAB) {
        var autocompleteItem = this.autoCompleter.getSelectedItem();

        if(autocompleteItem) {
          this.addMention( autocompleteItem );
          return false;
        }
      }

      return true;
    },

    // External methods
    val : function (callback) {
      var value = this.mentionsCollection.length ? this.messageText : this.getInputBoxValue();
      callback.call(this, value);
    },

    reset : function () {
      resetInput();
    },

    getMentions : function (callback) {
      if (!_.isFunction(callback)) {
        return;
      }

      callback.call(this, this.mentionsCollection);
    }
  });

  // Exposing mentionsInput on jQuery-object
  $.fn.mentionsInput = function (method, settings) {

    var outerArguments = arguments;

    if (typeof method === 'object' || !method) {
      settings = method;
    }

    if( !settings.autoCompleter ) {
      settings.autoCompleter = $.fn.mentionsInput.defaultAutocompleterProxy;
    }

    return this.each(function () {
      var instance = $.data(this, 'mentionsInput') || $.data(this, 'mentionsInput', new MentionsInput(settings, this));

      if (_.isFunction(instance[method])) {
        return instance[method].apply(this, Array.prototype.slice.call(outerArguments, 1));
      }
    });
  };

  // Exposing defaultAutocompleterProxy on jQuery-object
  $.fn.mentionsInput.defaultAutocompleterProxy = function () {
    _.extend(this, {
      initialize: function(mentionsInput, elmWrapperBox) {
        var self = this;
        this.autoCompleter = new SimpleAutoCompleter(elmWrapperBox, {});

        this.autoCompleter.onItemSelected.progress(function(item) {
          mentionsInput.addMention( self.format(item) );
        });
      },

      getSelectedItem: function() {
        var item = this.autoCompleter.getActiveItemData();
        return this.format(item);
      },

      isVisible: function() {
        return this.autoCompleter.isVisible();
      },

      hide: function() {
        this.autoCompleter.hide();
      },

      format: function(item) {
        return {
          value:  item.name,
          id:     item.id,
          type:   item.type
        };
      },

      populate: function() {
        this.autoCompleter.populate.apply( this.autoCompleter, _.toArray(arguments) );
      },

      loading: $.noop
   });
  };

  // Exposing defaultAutocompleterProxy on jQuery-object
  $.fn.mentionsInput.defaultSettings = defaultSettings;


})(jQuery, _);
