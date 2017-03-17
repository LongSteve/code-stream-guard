var __approot = require('app-root-path');
var winston = require ('winston');
var moment = require ('moment');
var jsonfile = require ('jsonfile');

var config = require (__approot + '/modules/config.js');
var server = require (__approot + '/modules/server.js');
var followers = require (__approot + '/modules/followers.js');
var chatter = require (__approot + '/modules/chatter.js');
var strings = require (__approot + '/modules/strings.js');

var Avatar = require (__approot + '/modules/avatar.js');

var AnnounceViewersPlugin = function AnnounceViewersPlugin () {
   var self = this;

   // Store a map of viewers for the session (in memory)
   var viewers = {};

   self.init = function init (callback) {

      winston.verbose ('AnnounceViewersPlugin: init');

      // The joined event is emitted with a single nickname
      chatter.on ('joined', function (nickname) {

         winston.info ((followers.isFollower (nickname) ? 'Follower ': '') + nickname + ' joined the chat room');

         var now = new Date;
         if (viewers [nickname]) {
            viewers [nickname].join_count++;
            viewers [nickname].last_joined = now;
         } else {
            // Not seen this viewer before
            viewers [nickname] = {
               first_joined: now,
               last_joined: now,
               last_left: null,
               join_count: 1,
               last_greeted_at: null,
               avatar_last_shown_at: null,
               greeting_timer: null
            };
         }

         winston.debug (nickname + " seen " + viewers [nickname].join_count + "time(s), first joined at: " + viewers [nickname].join_count);

         // Set the timer for default 3 seconds that announces new joiners.  The timeout is so that
         // anyone joining and leaving very quickly doesn't spam the announcement
         var timeout = config ['greenting-timeout'] || 3000;

         // Greeting timer already set?
         if (viewers [nickname].greeting_timer) {
            winston.warn ("Greeting timer already running for: " + nickname);
            return;
         }

         var greet = function delayedGreet (name) {
            return function greetNow () {

               var isFollower = followers.isFollower (name);

               // Clear the saved timer
               viewers [name].greeting_timer = null;

               var greetDate = new Date;  // don't use now, it'll be 3 seconds behind!

               if (nickname !== config.channel) {
                  if (viewers [name].last_greeted_at) {
                     winston.info ("Already greeted " + name + " at " + viewers [name].last_greeted_at);
                  } else {
                     winston.info ("Sending greetings to " + name);
                     chatter.sendMessage (strings.get (isFollower ? 'chat-welcome-follower' : 'chat-welcome-normal', { 'name': name }));
                     viewers [name].last_greeted_at = greetDate;
                  }
               }

               if (!isFollower && viewers [name].avatar_last_shown_at) {
                  winston.info ("Already shown avatar for " + name + " at " + viewers [name].avatar_last_shown_at);
               } else {
                  var av = new Avatar ();
                  av.requestImage (name, function requestImageCallback (error, image_url) {
                     winston.info ("Showing greeting avatar for " + name);
                     server.toClient ('new joiner', {
                        'nickname': name,
                        'image_url': image_url,
                        'message': strings.get ('frontend-welcome', {'name': name}),
                        'isFollower': isFollower
                     });
                     viewers [name].avatar_last_shown_at = new Date;    // new date, since image url request takes some time
                  });
               }
            };
         };

         winston.debug ("Setting greeting timer " + timeout + " for " + nickname);
         viewers [nickname].greeting_timer = setTimeout (greet (nickname), timeout);

      });

      // The left event is emitted with a single nickname
      chatter.on ('left', function (nickname) {
         winston.info (nickname + ' left the chat room');
         if (viewers [nickname]) {
            viewers [nickname].last_left = new Date;
            if (viewers [nickname].greeting_timer) {
               winston.debug ("Cancelling greeting timer for " + nickname);
               clearTimeout (viewers [nickname].greeting_timer);
               viewers [nickname].greeting_timer = null;
            }
         }
      });

      if (callback) {
         process.nextTick (function () {
            callback (null);
         });
      }
   };

   self.term = function term (callback) {
      winston.verbose ('AnnounceViewersPlugin: term');

      // Save the viewers data as json file, for later inspection
      if (Object.keys (viewers).length > 0) {
         var dateString = moment().format('YYYYMMDD_HHmm');
         var savedViewersFilename = "viewers_" + dateString + ".json";
         jsonfile.writeFile (__approot + "/saved/" + savedViewersFilename, viewers, function wroteJsonViewersFile (error) {
            if (error) {
               winston.error ("Error saving viewers to json file: " + savedViewersFilename, error);
            } else {
               winston.info("Saved viewers to json file: " + savedViewersFilename);
            }
            if (callback) {
               callback (error, null);
            }
         });
      }
   };

};

module.exports = exports = new AnnounceViewersPlugin ();

