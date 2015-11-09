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
          'dist/Composable.js': 'src/*.js'
        }
      },

      test: {
        files: {
          'build/tests.js': 'test/*.js'
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

  grunt.registerTask('default', ['build']);
  grunt.registerTask('build', ['browserify:dist', 'browserify:test']);
  grunt.registerTask('watch', ['browserify:watch']);

};
