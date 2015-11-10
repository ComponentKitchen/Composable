module.exports = function (grunt) {

  'use strict';

  grunt.loadNpmTasks('grunt-browserify');

  // Project configuration.
  grunt.initConfig({

    browserify: {

      options: {
        browserifyOptions: {
          debug: true // Ask for source maps
        },
        transform: ['babelify']
      },

      dist: {
        files: {
          'dist/Composable.js': 'src/*.js',
          'dist/test/tests.js': 'test/*.js'
        }
      },

      watch: {
        files: {
          'dist/Composable.js': 'src/*.js',
          'build/tests.js': 'test/*.js'
        },
        options: {
          keepAlive: true,
          watch: true
        }
      }
    }

  });

  grunt.registerTask('default', function() {
    grunt.log.writeln('grunt commands this project supports:\n');
    grunt.log.writeln('  grunt build');
    grunt.log.writeln('  grunt watch');
  });

  grunt.registerTask('build', ['browserify']);
  grunt.registerTask('watch', ['browserify:watch']);

};
