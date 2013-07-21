/*
 * Simple autocompeter (bundled with Mentions Input)
 * Version 1.0
 * Written by: Kenneth Auchenberg (Podio)
 *
 * Using underscore.js
 *
 * License: MIT License - http://www.opensource.org/licenses/mit-license.php
 */

/* global define,_,$ */

;(function (window) {
  'use strict';

  var KEY = { Tab : 9, Return : 13, Esc : 27, LeftArrow : 37, UpArrow : 38, RightArrow : 39, DownArrow : 40 }; // Keys "enum"
  var defaultOptions = {
    selectFirstItem     : true,
    useAbsolutePosition : false,
    classes : {
      autoCompleteItemActive : 'active',
      item : 'item',
      autocompleter : ''
    }
  };

  var defaultTemplates = {
    wrapper       : _.template('<div class="simple-autocompleter"></div>'),
    list          : _.template('<ul class="hidden"></ul>'),
    item          : _.template('<li class="item" data-id="<%= id %>"> <div class="image-block"> <% if(itemIcon) { %> <div class="img space-right icon"> <%= itemIcon %> </div> <% } %> <div class="bd"> <div class="info">  <%= value %> </div> </div> </div> </li>'),
    image         : _.template('<img  src="<%= url %>" />'),
    icon          : _.template('<div class="<%= icon %>"></div>')
  };

  var utils = {
    highlightTerm    : function (value, term) {
      if (!term) {
        return value;
      }

      return value.replace(new RegExp('(?![^&;]+;)(?!<[^<>]*)(' + term + ')(?![^<>]*>)(?![^&;]+;)', 'gi'), '<b>$1</b>');
    }
  };

  var SimpleAutoCompleter = function(elmContainer, options) {
    this.options = $.extend(true, {}, defaultOptions, options);
    this.templates = defaultTemplates;
    this.elmContainer = elmContainer;

    this.initialize.apply(this, arguments);
  };

  _.extend(SimpleAutoCompleter.prototype, {

      initialize : function() {
        _.bindAll(this, 'onBoxKeyDown', 'onAutoCompleteItemMouseDown', 'renderItem');

        this.initElements();
        this.delegateEvents();

        this.onItemSelected = new $.Deferred();
      },

      initElements : function() {
        if(!this.elmContainer) {
          throw 'No container element passed';
        }

        // Construct elements
        this.elmWrapper = $( this.templates.wrapper() );

        this.elmAutocompleteList = $( this.templates.list() );
        this.elmAutocompleteList.appendTo( this.elmWrapper );

        // Inject into DOM
        this.elmWrapper.appendTo( this.elmContainer );
      },

      delegateEvents : function() {
        this.elmAutocompleteList.delegate('li', 'mousedown', this.onAutoCompleteItemMouseDown );

        // Bind to container, since focus most likely is in a input element
        this.elmContainer.bind('keydown', this.onBoxKeyDown);
      },

      _selectItem : function(elmItem) {
        elmItem.addClass( this.options.classes.autoCompleteItemActive );
        elmItem.siblings().removeClass( this.options.classes.autoCompleteItemActive );
      },

      _getItemData: function(itemId) {

        var itemsCollection = this.currentItemsCollections;

        var itemData = _.find(itemsCollection, function(item) {
          return item.id === itemId;
        });

        return itemData;
      },

      onAutoCompleteItemMouseDown : function (e) {
        e.preventDefault();
        e.stopPropagation();

        var itemId = $(e.currentTarget).data('id');
        var itemData = this._getItemData(itemId);

        this.onItemSelected.notify(itemData);

        return false;
      },

      onBoxKeyDown : function(e) {
        if ( !this.isVisible() ) {
          return true;
        }

        var elmActiveItem = this.elmAutocompleteList.find('.' + this.options.classes.item + '.' + this.options.classes.autoCompleteItemActive);

        switch(e.keyCode) {

          case KEY.DownArrow:
          case KEY.UpArrow:

            if (e.keyCode === KEY.DownArrow) {
              elmActiveItem = elmActiveItem.length ? elmActiveItem.next('.' + this.options.classes.item) : this.elmAutocompleteList.find('.' + this.options.classes.item).first();
            } else {
              elmActiveItem = elmActiveItem.prev('.' + this.options.classes.item);
            }

            if (elmActiveItem.length) {
              this._selectItem(elmActiveItem);
            }

            return false;

          case KEY.Return:
          case KEY.Tab:
            elmActiveItem.trigger('mousedown');
            return false;

          case KEY.Esc:
            this.hide();
            return false;
        }
      },

      renderList : function(items, termToHighlight) {
        var self = this;

        return _.map(items, function(item, index) {
          return self.renderItem(item, index, termToHighlight);
        });
      },


      renderIcon : function(data) {
        var html;

        if (data.indexOf('/') > -1 ) { // Not a valid CSS class with / => image
          html = this.templates.image({ url : data });
        } else {
          html = this.templates.icon({ icon : data });
        }

        return html;
      },

      renderItem : function(item, index, termToHighlight) {
        var htmlItemIcon;

        if ( item.avatar )  {
          htmlItemIcon = this.renderIcon( item.avatar );
        }

        var elmListItem = $( this.templates.item({
          'id'          : _.escape(item.id),
          'value'       : utils.highlightTerm( _.escape(item.name) , termToHighlight ),
          'itemIcon'    : htmlItemIcon
        }));

        if (this.options.selectFirstItem && index === 0) {
          this._selectItem(elmListItem);
        }

        return elmListItem;
      },

      selectItem : function(index) {
        var elmItem = this.elmAutocompleteList.find('.' + this.options.classes.item).eq(index);

        this._selectItem(elmItem);
      },

      useActiveItem: function() {
        var elmActiveItem = this.elmAutocompleteList.find('.' + this.options.classes.item + '.' + this.options.classes.autoCompleteItemActive);
        elmActiveItem.trigger('mousedown');
      },

      populate : function(itemsCollection, termToHighlight) {
        if (!itemsCollection.length) {
          this.hide();
          return;
        }

        this.currentItemsCollections = itemsCollection;

        var elmTemp = $('<div />');
        var elmRenderedItems = this.renderList(itemsCollection, termToHighlight);
        elmTemp.append.apply( elmTemp, elmRenderedItems);

        this.elmAutocompleteList.html(elmTemp.html() );
        this.show();
      },

      show: function() {
        this.elmAutocompleteList.removeClass('hidden');
      },

      hide : function() {
        this.elmAutocompleteList.addClass('hidden');
        this.currentItemsCollections = null;
      },

      isVisible : function() {
        return this.elmAutocompleteList.is(':visible');
      },

      getActiveItemData : function() {
        var elmActiveItem = this.elmAutocompleteList.find('.' + this.options.classes.item + '.' + this.options.classes.autoCompleteItemActive);

        if(!elmActiveItem.length) {
          return null;
        }

        var itemId = elmActiveItem.data('id');
        var itemData = this._getItemData(itemId);

        return itemData;
      }
  });

  if (typeof define === 'function' && define.amd) {
    define(function() {
      window.SimpleAutoCompleter = SimpleAutoCompleter;
      return SimpleAutoCompleter;
    });
  } else {
    window.SimpleAutoCompleter = SimpleAutoCompleter;
  }

})(this);
