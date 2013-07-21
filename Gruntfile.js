module.exports = function(grunt) {

  grunt.initConfig({
    sass: {                              // Task
      dist: {                            // Target
        options: {                       // Target options
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
