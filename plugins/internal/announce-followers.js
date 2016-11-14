var __approot = require('app-root-path');
var winston = require ('winston');

var config = require (__approot + '/modules/config.js');
var server = require (__approot + '/modules/server.js');
var followers = require (__approot + '/modules/followers.js');
var chatter = require (__approot + '/modules/chatter.js');
var strings = require (__approot + '/modules/strings.js');

var Avatar = require (__approot + '/modules/avatar.js');

var AnnounceFollowersPlugin = function AnnounceFollowersPlugin () {
   var self = this;

   self.init = function init (callback) {

      winston.verbose ('AnnounceFollowersPlugin: init');

      // The followed event is emitted, passed with an array of follower names
      followers.on ('followed', function (followers) {
         winston.info ('New followers: ' + followers);
         followers.forEach (function (f) {
            if (chatter) {
               chatter.sendMessage(strings.get('chat-new-follower', { 'name': f }));
            }

            var av = new Avatar ();
            av.requestImage (f, function requestImageCallback (error, image_url) {
               server.toClient ('new follower', {
                  'nickname': f,
                  'image_url': image_url,
                  'message': strings.get ('frontend-latest-follower', {'name': f})
               });
            });
         });
      });

      // The unfollowed event is emitted, with an array of follower names
      followers.on ('unfollowed', function (followers) {
         winston.info ('Unfollowed: ' + followers);
         if (chatter) {
            followers.forEach(function(f) {
               chatter.sendMessage (strings.get ('chat-unfollowed', {'name': f}));
            });
         }
      });

      if (callback) {
         process.nextTick (function () {
            callback (null);
         });
      }
   };

   self.term = function term (callback) {
      winston.verbose ('AnnounceFollowersPlugin: term');
      if (callback) {
         process.nextTick (function () {
            callback (null);
         });
      }
   };

};

module.exports = exports = new AnnounceFollowersPlugin ();
