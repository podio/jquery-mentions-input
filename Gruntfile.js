module.exports = function(grunt) {
  'use strict';

  grunt.initConfig({
    sass: {
      dist: {
        options: {
          style: 'expanded'
        },
        files: {
          'dist/MentionsInput.css': 'src/MentionsInput.scss',
          'dist/SimpleAutoCompleter.css': 'src/SimpleAutoCompleter.scss'
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-sass');
  grunt.registerTask('default', ['sass']);

};
