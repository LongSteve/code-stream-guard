//
// Chat bot module
//

var _ = require ('lodash');

var winston = require ('winston');

var fs = require ('fs');
var util = require ('util');

var __approot = require('app-root-path');

var Bottleneck = require('bottleneck');

var EventEmitter = require ('events').EventEmitter;

var xmppbot = require (__approot + '/modules/xmpp.js');
var config = require (__approot + '/modules/config.js');
var strings = require (__approot + '/modules/strings.js');

var MockChatter = function MockChatter () {
   var self = this;

   var username = config.nickname.substring (0, config.nickname.indexOf ('@'));
   var channel = config.channel;

   self.getChannel = function getChannel () {
      return channel;
   };

   self.getUsername = function getUsername () {
      return username;
   };

   self.sendMessage = function sendMessage (message) {
      winston.debug ("Mock Message: " + message);
   };
};

var Chatter = function Chatter () {
   var self = this;

   var username = config.nickname.substring (0, config.nickname.indexOf ('@'));
   var channel = config.channel;

   var commands = {};

   var helpmessage = strings.get ('help-message-header');

   var bot = new xmppbot (config);

   //
   // Load the set of dynamic commands from the commands folder
   //
   fs.readdirSync (__approot + '/commands/').forEach (function (file) {
      if (file.match (/.+\.js/g) !== null) {
         var name = file.replace ('.js', '');
         commands [name] = require (__approot + '/commands/' + file);
         commands [name].init (self, config, strings, bot);

         winston.info ('Loaded the ' + name + ' chatter module.');
         var helpstring = '  !' + commands [name].name + ' ' + commands [name].args;
         helpstring = _.padEnd (helpstring, 10);
         helpstring += '- ' + commands [name].help + "\n";

         helpmessage += helpstring;
      }
   });

   var limiter = new Bottleneck (1, 1000);

   var sendRateLimitedMessage = function (channel, message) {
      limiter.submit (function (cb) {
         bot.message (channel, message);
         process.nextTick (function () {
            cb (null);
         });
      }, null);
   };

   bot.on( 'command!help', function (channel, text, nickname, stanza) {
      sendRateLimitedMessage (channel, helpmessage);
   });

   bot.on ('online', function (data) {
      winston.info ('Joining the ' + channel + ' channel as ' + username);
      bot.join (channel, username);
   });

   bot.on ('error', function (e) {
      winston.error ('error...');
      winston.error (e);
   });

   bot.on( 'msg', function (nickname, _channel, message, stanza) {
      winston.debug (nickname + ' said "' + message + '" in ' + _channel );
   });

   bot.on( 'join', function (_channel, nickname, stanza) {
      winston.debug (nickname + ' has joined channel ' + _channel);

      // When the bot joins the room, issue the greeting message
      if (nickname === username) {
         var greeting = strings.get ('chat-bot-greeting', {'name': config ['chatname']});
         sendRateLimitedMessage (channel, greeting);
         sendRateLimitedMessage (channel, helpmessage);
      } else {
         // Emit the joined event for all other users
         self.emit ('joined', nickname);
      }
   });

   bot.on( 'part', function (_channel, nickname, stanza) {
      winston.debug (nickname + ' has left channel ' + _channel);
      self.emit ('left', nickname);
   });

   self.getChannel = function getChannel () {
      return channel;
   };

   self.getUsername = function getUsername () {
      return username;
   };

   self.sendMessage = function sendMessage (message) {
      sendRateLimitedMessage (channel, message);
   };
};

util.inherits (Chatter, EventEmitter);
util.inherits (MockChatter, EventEmitter);

//module.exports = exports = new MockChatter ();
module.exports = exports = new Chatter ();

