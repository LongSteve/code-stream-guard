var __approot = require('app-root-path');
var winston = require ('winston');

var config = require (__approot + '/modules/config.js');
var server = require (__approot + '/modules/server.js');
var chatter = require (__approot + '/modules/chatter.js');

var AnnounceRatingsPlugin = function AnnounceRatingsPlugin () {
   var self = this;

   self.init = function init (callback) {

      winston.verbose ('AnnounceRatingsPlugin: init');

      // Someone has rated, send a message to the UI to display it
      chatter.on ('rating', function (event) {
         winston.info (event.nickname + ' has given a rating: ' + event.rating);
         server.toClient ('new rating', {'percent': event.rating});
      });

      if (callback) {
         process.nextTick (function () {
            callback (null);
         });
      }
   };

   self.term = function term (callback) {
      winston.verbose ('AnnounceRatingsPlugin: term');
      if (callback) {
         process.nextTick (function () {
            callback (null);
         });
      }
   };

};

module.exports = exports = new AnnounceRatingsPlugin ();
