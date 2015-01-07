jquery.mentionsInput
=================
jquery.mentionsInput is a small, but awesome UI component that allows you to "@mention" someone in a text message, just like you are used to on Facebook or Twitter.

This project is written by [Kenneth Auchenberg](http://kenneth.io), and started as an internal project at [Podio](http://podio.com), but has then been open sourced to give it a life in the community.

## Introduction
To get started -- checkout http://podio.github.com/jquery-mentions-input

## Latest release

1.6.0 (2015-Jan-7) -- https://github.com/podio/jquery-mentions-input/releases/tag/1.6.0

## Bugs and Enhancements (next version)

- [ ] Fix #74 Mention on ordinary input field not textarea
- [ ] Fix #26 Capital letter as trigger character
- [ ] Fix #59 Unicode characters support
- [X] Fix #104 When same text which is to be mentioned already in the content
- [ ] Fix #100 New option for conserve triggerChar in output

## License

MIT License - http://www.opensource.org/licenses/mit-license.php

## Dependencies

jquery.mentionsInput is written as a jQuery extension, so it naturally requires jQuery (1.6+). In addition to jQuery, it also depends on underscore.js (1.2+), which is used to simplify stuff a bit.

The component is also using the new HTML5 "input" event. This means older browsers like IE8 need a polyfill which emulates the event (it is bundled).

The component itself is implemented as a small independent function, so it can easily be ported to frameworks other than jQuery.

Furthermore all utility functions have been centralized in the utils-object, which can be replaced with references if you already got functions like htmlEncode, etc.

To make the component grow and shrink to fit it’s content, you can include jquery.elastic.js

## Browser support

jquery.mentionsInput has been tested in Firefox 6+, Chrome 15+, and Internet Explorer 8+.

Please let us know if you see anything weird. And no, we will no make it work for older browsers. Period.

## Reporting issues

Please provide jsFiddle when creating issues!

It's really saves much time.

Your feedback is very appreciated!

## Roadmap
- Fix open issues.
- Seperate mentionsInput from jQuery, and expose as AMD/CJS module.
- Seperate autocompleter, so it's possible to use bootstrap, jquery, etc-autocompleters
- Define better interface to call methods.
- Add the option to have a hidden-input that contains the syntaxed-version, so it's easier to use out of the box.
- Add unit tests!
- Add mobile support
