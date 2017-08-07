jquery.mentionsInput
=================
jquery.mentionsInput is a small, but awesome UI component that allows you to "@mention" someone in a text message, just like you are used to on Facebook or Twitter.

This project is written by [Kenneth Auchenberg](http://kenneth.io), and started as an internal project at [Podio](http://podio.com), but has then been open sourced to give it a life in the community.

This fork of the Podio's mentionsInput (v1.6.0) is developed by [Rich Jeffery](http://github.com/richjeffery) at [Worktribe](http://worktribe.com), and has some added adjustments and improvements, including adjustments for newer versions of jQuery, mobile support, and autocompletion of individual names. See [CHANGELOG](https://github.com/richjeffery/jquery-mentions-input/blob/master/CHANGELOG.md) for full details.

## Introduction
To get started -- checkout http://richjeffery.github.com/jquery-mentions-input

## Latest release

1.0.3 (2017-Apr-8) -- https://github.com/richjeffery/jquery-mentions-input/releases/tag/1.0.3

## License

MIT License - http://www.opensource.org/licenses/mit-license.php

## Dependencies

jquery.mentionsInput is written as a jQuery extension, so it naturally requires jQuery (1.7+). In addition to jQuery, it also depends on underscore.js (1.2+), which is used to simplify stuff a bit.

The component is also using the new HTML5 "input" event. This means older browsers like IE8 need a polyfill which emulates the event (it is bundled).

The component itself is implemented as a small independent function, so it can easily be ported to frameworks other than jQuery.

Furthermore all utility functions have been centralized in the utils-object, which can be replaced with references if you already got functions like htmlEncode, etc.

jquery.elastic.js is required for correct operation of boxes that don't scale.