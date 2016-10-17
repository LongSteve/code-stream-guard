var _ = require ('lodash');

//
// Get the config settings
//
var config = require ('./config.js');
config.init ('livecoding.tv');

//
// Kick off the follower feed checking
//
var followers = require ('./followers.js');

//
// Attach to the chat channel and monitor/respond as a bot
//
var chatter = require ('./chatter.js');

// The followed event is emitted, passed with an array of follower names
followers.on ('followed', function (followers) {
   console.log ('New followers: ' + followers);
   followers.forEach (function (f) {
      chatter.sendMessage ('Thanks for following, ' + f + ' much appreciated');
   });
});

// The unfollowed event is emitted, with an array of follower names
followers.on ('unfollowed', function (followers) {
   console.log ('Unfollowed: ' + followers);
});

// The joined event is emitted with a single nickname
chatter.on ('joined', function (nickname) {
   console.log (nickname + ' joined the chat room');
   if (nickname !== 'longsteve') {
      if (followers.isFollower(nickname)) {
         chatter.sendMessage ("Welcome esteemed follower " + nickname);
      } else {
         chatter.sendMessage ("Hi " + nickname + " how's it going?");
      }
   }
});

// The left event is emitted with a single nickname
chatter.on ('left', function (nickname) {
   console.log (nickname + ' left the chat room');
});
