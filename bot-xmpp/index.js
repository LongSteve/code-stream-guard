'use strict'

//
// Initial code borrowed from https://github.com/LiveCodeMonkeys/lctvbot_module
//

var xmpp = require("node-xmpp-client");
var ltx = require('node-xmpp-core').ltx;
var util = require('util');
var events = require('events');

//
// usage:
// var xmppbot = require ('bot-xmpp');
// var lctvbot = new xmppbot ({
//    domain: "chat.livecoding.tv",
//    nickname: "username@livecoding.tv",
//    password: "password"
// });
// 

var bot = function (config) {

   this.channels = [ ];
   this.config = config;
   this.client = new xmpp( {
      reconnect: true,
      jid: config.nickname,
      domain: config.domain,
      password: config.password
   });

   var self = this;

   this.client.on ('error', function (e) {
      self.emit ('error', e);
   });

   this.client.on ('online', function (data) {
      self.emit('online', data);
   });

   this.client.on ('stanza', function (stanza) {
      var event;
      switch (stanza.type) {
         case "error":
            event = 'error';
            break;
         case "result":
            var ns = stanza.getChild ('query').attrs.xmlns //From Whisperer, need to test
            event = ns.split('#').pop
            break;
         default:
            event = stanza.name;
            break;
      }

      if (event == 'message') {
         var msg = self.getMessage (stanza);
         if (typeof stanza.getChild ('delay') == "undefined") { //If a message has a timestamp it's a replay, ignore it
            if (msg.indexOf ('!') == 0) {
               var tmp = msg.split (" ");
               var command = tmp.shift();
               var text = tmp.join (" ");
               // console.log( stanza );
               var from;
               if (stanza.type == 'chat') {
                  from = stanza.attrs.from;
               } else {
                  from = stanza.attrs.from.substring (0, stanza.attrs.from.indexOf ('/'));
               }
               self.emit ('command' + command, self.getChannel (stanza), text, self.getNickname (stanza), stanza);
               //console.log ('command: ' + command);
            }
         }
         if (typeof stanza.getChild ('delay') == "undefined") {
            self.emit ('msg', self.getNickname (stanza), self.getChannel (stanza), msg, stanza);
         }
      }

      if (event == "presence") {
         var index;
         var from = stanza.attrs.from;
         var channel = self.getChannel (stanza);
         var nickname = self.getNickname (stanza);
         var affiliation = stanza.getChild ('x').getChild ('item').attrs.affiliation;
         //console.log( [ channel, nickname, affiliation ] );
         if (typeof stanza.attrs.type !== 'undefined' && stanza.attrs.type == 'unavailable') {
            index = self.channels [channel].users.indexOf (nickname)
            if (index > -1) {
               if (affiliation == 'admin') {
                  self.channels [channel].mods.splice (index, 1);
               } else {
                  self.channels [channel].users.splice (index, 1);
               }
               self.emit ('part', channel, nickname, stanza);
            }
         } else {
            if (affiliation == 'admin') {
               self.channels [channel].mods.push (nickname);
            } else {
               self.channels [channel].users.push (nickname);
            }
            self.emit ('join', channel, nickname, stanza);
         }
      }
      self.emit (event, stanza);
   });
};

util.inherits(bot, events.EventEmitter);

// Join a channel
bot.prototype.join = function (channel, nickname) {
   if (channel.indexOf ('@') == -1) {
      channel += "@" + this.config.domain;
   }
   var presence = new ltx.Element ('presence', {
      to: channel + '/' + nickname
   }).c ('x', { xmlns: 'http://jabber.org/protocol/muc' });
   this.client.send (presence);
   this.channels [channel.substring (0, channel.indexOf ('@'))] = { users: [ ], mods: [ ] };
   //console.log( this.channels );
};

bot.prototype.part = function (channel) {
   var channelName = channel;
   if (channel.indexOf ('@') == -1) {
      channel += "@" + this.config.domain;
   }

   var presence = new ltx.Element ('presence', {
      to: channel + '/' + this.config.nickname,
      type: "unavailable"
   }).c ('x', { xmlns: 'http://jabber.org/protocol/muc' });
   this.client.send (presence);
   this.channels.splice (this.channels.indexOf (channelName));
};

//Get a message from the stanza
bot.prototype.getMessage = function (stanza) {
   return stanza.getChild ('body').children.toString ();
};

//Sends a message to the server
bot.prototype.message = function (to, message, type) {
   var stanza;
   if (type == undefined) {
      type = 'groupchat';
   }
   if (type == 'groupchat' && to.indexOf ('@') == -1) {
      to += "@" + this.config.domain;
   }
   //console.log( [ to, message, type ] );
   stanza = new ltx.Element ('message', { to: to, type: type, from: this.config.jid });
   //console.log (stanza.root ().toString ());
   this.client.send (stanza.c ('body').t (message));
};

bot.prototype.say = function (to, message) {
   this.message (to, message);
};

bot.prototype.getTimeStamp = function (stanza) {
   return stanza.getChild ( 'delay' ).attrs.stamp;
};

//Get the nickname from the stanza
bot.prototype.getNickname = function (stanza) {
   var from = stanza.attrs.from;
   return from.substring (from.indexOf('/') + 1, from.length);
};

//Get the channel from the stanza
bot.prototype.getChannel = function (stanza) {
   var from = stanza.attrs.from;
   return from.substring (0, from.indexOf ('@'));
};

bot.prototype.isMod = function (channel, user) {
   if (this.channels [channel].mods.indexOf (user) > -1) {
      return true;
   }
   return false;
};
module.exports = bot;
