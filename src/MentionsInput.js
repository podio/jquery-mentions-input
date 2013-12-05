/*
 * MentionsInput
 * Version 2.0
 * Written by: Kenneth Auchenberg
 *
 * Copyright (c) 2013 - Citrix Systems, Inc.
 *
 * Using underscore.js
 *
 * License: MIT License - http://www.opensource.org/licenses/mit-license.php
 */

 /* global define,_,$ */

;(function (window) {
  'use strict';

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
      mentionItemSyntax       : _.template('@[<% print(value) %>](<%= type %>:<%= id %>)'),
      mentionItemHighlight    : _.template('<strong><span><% print(value) %></span></strong>')
    },
    autoCompleter: {
      initialize: function(elmWrapperBox, mentionsInput) {
        var self = this;
        var autoCompleter = new SimpleAutoCompleter(elmWrapperBox, {});

        autoCompleter.onItemSelected.progress(function(item) {
          mentionsInput.addMention( self.format(item) );
        });

        return autoCompleter;
      },
      getSelectedItem : 'getActiveItemData',
      isVisible: 'isVisible',
      populate: 'populate',
      loading: $.noop,
      hide: 'hide',
      'format': function(item) {
        return {
          value:  item.name,
          id:     item.id,
          type:   item.type
        };
      }
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
      return string.replace(/\s+$/,'');
    }
  };

  var MentionsInput = function(elmTarget, settings) {

    _.bindAll(this, 'onInputBoxKeyDown', 'onInputBoxKeyPress', 'onInputBoxInput', 'onInputBoxClick', 'onInputBoxBlur', 'resetBuffer', 'getMentions', 'val');

    this.elmInputWrapper  = null;
    this.elmWrapperBox  = null;
    this.elmMentionsOverlay = null;

    this.autoCompleter = null;
    this.mentionsCollection = [];
    this.inputBuffer = [];
    this.currentDataQuery = '';

    this.initialize.call(this, elmTarget, settings);
  };

  _.extend(MentionsInput.prototype, {

    initialize : function(elmTarget, settings) {

      this.elmInputBox = $(elmTarget);
      this.settings = $.extend(true, {}, defaultSettings, settings);

      this.initTextarea();
      this.initMentionsOverlay();
      this.initAutocomplete();

      if(this.settings.resetOnInitialize) {
        this.resetInput();
      }

      if(this.settings.prefillMention) {
        this.addMention( this.settings.prefillMention );
      }
    },

    initAutocomplete : function() {
      this.autoCompleter = this.settings.autoCompleter.initialize(this.elmWrapperBox, this);
    },

    initTextarea : function() {

      this.elmInputWrapper = this.elmInputBox.parent();
      this.elmWrapperBox = $(this.settings.templates.wrapper());
      this.elmInputBox.wrapAll(this.elmWrapperBox);
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

      // Contruct element
      this.elmMentionsOverlay = $(this.settings.templates.mentionsOverlay());

      // Copy CSS properties to inner <div>
      var cssHash = {};
      var cssProperties = ['lineHeight', 'fontSize', 'fontFamily', 'fontWeight'];
      var i = cssProperties.length;
      while (i--) {
        cssHash[ cssProperties[i].toString() ] = this.elmInputBox.css( cssProperties[i].toString() );
      }
      this.elmMentionsOverlay.find('div').css( cssHash );

      // Append to wrapper
      this.elmMentionsOverlay.prependTo(this.elmWrapperBox);
    },

    _autoCompleterMethod: function(method) {

      var ref = this.settings.autoCompleter[method];

      if(_.isFunction(ref)) {
        return ref();
      } else {
        return this.autoCompleter[ref]();
      }

    },

    _doSearch: function(query) {
      var self = this;

      if (query && query.length && query.length >= this.settings.minChars) {

        this._autoCompleterMethod('loading');

        this.settings.onDataRequest.call(this, 'search', query, function (autoCompleteData) {

          // Filter items that has already been mentioned
          var mentionValues = _.pluck(self.mentionsCollection, 'value');

          autoCompleteData = _.reject(autoCompleteData, function (item) {
            return _.include(mentionValues, item.name);
          });

          self.autoCompleter.populate(autoCompleteData, query);

        });
      } else {
        this.hideAutoCompleter();
      }
    },

    hideAutoCompleter : function() {
      this._autoCompleterMethod('hide');
    },

    replaceAll: function(text, match, replacement) {
      // Utility method to replace all occurences
      match = match.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
      return text.replace(new RegExp(match, 'gm'), replacement);
    },

    updateValues: function() {
      var syntaxMessage = this.getInputBoxValue();

      _.each(this.mentionsCollection, function (mention) {
        var textSyntax = this.settings.templates.mentionItemSyntax(mention);
        syntaxMessage = this.replaceAll(syntaxMessage, mention.value, textSyntax);
      }, this);

      var mentionText = _.escape( syntaxMessage );

      _.each(this.mentionsCollection, function (mention) {

        var formattedMention = _.extend({}, mention, {
          value: _.escape( mention.value )
        });

        var textSyntax = this.settings.templates.mentionItemSyntax(formattedMention);
        var textHighlight = this.settings.templates.mentionItemHighlight(formattedMention);

        mentionText = this.replaceAll(mentionText, textSyntax, textHighlight);
      }, this);

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

      this.mentionsCollection = _.reject(this.mentionsCollection, function (mention) {
        return !mention.value || inputText.indexOf(mention.value) === -1;
      });

      this.mentionsCollection = _.compact(this.mentionsCollection);
    },

    addMention: function(mention) {

      var currentMessage = this.getInputBoxValue();

      // Using a regex to figure out positions
      var regex = new RegExp('\\' + this.settings.triggerChar + this.currentDataQuery, 'gi');
      regex.exec(currentMessage);

      var startCaretPosition = regex.lastIndex - this.currentDataQuery.length - 1;
      var currentCaretPosition = regex.lastIndex;

      var start = currentMessage.substr(0, startCaretPosition);
      var end = currentMessage.substr(currentCaretPosition, currentMessage.length);
      var startEndIndex = (start + mention.value).length;

      if(this.settings.insertSpaceAfterMention) {
        startEndIndex = startEndIndex + 1;
      }

      //Check if the user is being mentioned twice (or more)
      var contained = _.find(this.mentionsCollection, function(existingMention) {
        return _.isEqual(existingMention, mention);
      });

      if(!contained) {
        this.mentionsCollection.push(mention);
      }

      // Cleaning before inserting the value, otherwise auto-complete would be triggered with "old" inputbuffer
      this.currentDataQuery = '';
      this.resetBuffer();
      this.hideAutoCompleter();

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

      utils.setCaratPosition(this.elmInputBox[0], startEndIndex);
    },

    getInputBoxValue: function() {
      return this.elmInputBox.val();
    },

    // Event handlers
    onInputBoxClick: function() {
      this.resetBuffer();
    },

    onInputBoxBlur: function() {
      this.hideAutoCompleter();
    },

    onInputBoxInput: function() {

      this.updateValues();
      this.updateMentionsCollection();

      var triggerCharIndex = _.lastIndexOf(this.inputBuffer, this.settings.triggerChar);

      if (triggerCharIndex === 0) {
        this.currentDataQuery = this.inputBuffer.slice(triggerCharIndex + 1).join('');
        this.currentDataQuery = utils.rtrim(this.currentDataQuery);

        _.defer(_.bind(this._doSearch, this, this.currentDataQuery));
      } else {
        this.hideAutoCompleter();
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
      if (e.keyCode === KEY.LEFT || e.keyCode === KEY.RIGHT || e.keyCode === KEY.HOME || e.keyCode === KEY.END ) {
        // Defer execution to ensure carat pos has changed after HOME/END keys
        _.defer(this.resetBuffer);

        // IE9 doesn't fire the oninput event when backspace or delete is pressed. This causes the highlighting
        // to stay on the screen whenever backspace is pressed after a highlighed word. This is simply a hack
        // to force updateValues() to fire when backspace/delete is pressed in IE9.
        if (navigator.userAgent.indexOf('MSIE 9') > -1) {
          _.defer(this.updateValues);
        }

        return;
      }

      // Special handling for space, since we want to reset buffer on space, but only when autocompleter is hidden
      if (e.keyCode === KEY.SPACE) {

        if (this._autoCompleterMethod('isVisible')) {
          // Allow spaces when autcompleter is visible
          return;
        }

        _.defer(this.resetBuffer);
      }

      if (e.keyCode === KEY.RETURN) {
        _.defer(this.resetBuffer);
      }

      if (e.keyCode === KEY.BACKSPACE) {
        this.inputBuffer = this.inputBuffer.slice(0, -1 + this.inputBuffer.length); // Can't use splice, not available in IE
        return;
      }

      return true;
    },

    // External methods
    val : function () {
      var value = this.mentionsCollection.length ? this.messageText : this.getInputBoxValue();
      return value;
    },

    getMentions : function () {
      return this.mentionsCollection;
    }

  });

  if (typeof define === 'function' && define.amd) {
    define(function() {
      window.MentionsInput = MentionsInput;
      return MentionsInput;
    });
  } else {
    window.MentionsInput = MentionsInput;
  }

})(this);
