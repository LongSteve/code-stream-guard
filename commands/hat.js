//
// The !hat command. Interfaces to the REST API of my Particle Core / RGB LED hat
//

var Particle = require('particle-api-js');

var winston = require ('winston');

var __approot = require('app-root-path');

var followers = require ('../modules/followers.js');
var chatter = require ('../modules/chatter.js');

module.exports = {
   name: 'hat',
   args: 'ARG ',

   particle_access_token: null,
   particle_device_id: null,

   handleError: function (name, error) {
      if (error.statusCode >= 400 && error.statusCode < 500) {
         // 400's are normal if the hat isn't powered up and online
         winston.warn ("Error " + error.statusCode + " calling hat "+name+" function, maybe it's offline?");
      } else if (error) {
         winston.error("Unexpected error " + error.statusCode + " calling hat "+name+" function: ", error);
      }
   },

   pulse: function () {
      var self = this;
      winston.verbose ("Calling hat pulse function");
      self.particle.callFunction ({
         'deviceId': self.particle_device_id,
         'auth': self.particle_access_token,
         'name': 'pulse',
         'argument': ''}).then (
         function (data) {
            winston.debug ("Success calling pulse function");
         },
         function (error) {
            self.handleError ("pulse", error);
         }
      );
   },

   rainbow: function () {
       var self = this;
       winston.verbose ("Calling hat rainbow function");
       self.particle.callFunction ({
          'deviceId': self.particle_device_id,
          'auth': self.particle_access_token,
          'name': 'rainbow',
          'argument': ''}).then (
          function (data) {
             winston.debug ("Success calling rainbow function");
          },
          function (error) {
             self.handleError ("rainbow", error);
          }
       );
   },

   color: function (c) {
       var self = this;
       winston.verbose ("Calling hat colorwipe function, " + c);
       self.particle.callFunction ({
          'deviceId': self.particle_device_id,
          'auth': self.particle_access_token,
          'name': 'colorwipe',
          'argument': c}).then (
          function (data) {
             winston.debug ("Success calling colorwipe function");
          },
          function (error) {
             self.handleError ("colorwipe", error);
          }
       );
   },

   chatter: function () {
       var self = this;
       winston.verbose ("Calling hat chatter function, 5");
       self.particle.callFunction ({
          'deviceId': self.particle_device_id,
          'auth': self.particle_access_token,
          'name': 'chatter',
          'argument': '5'}).then (
          function (data) {
             winston.debug ("Success calling chatter function");
          },
          function (error) {
             self.handleError ("chatter", error);
          }
       );
   },

   cylon: function (c) {
       var self = this;
       winston.verbose ("Calling hat cylon function, c");
       self.particle.callFunction ({
          'deviceId': self.particle_device_id,
          'auth': self.particle_access_token,
          'name': 'cylon',
          'argument': c}).then (
          function (data) {
             winston.debug ("Success calling cylon function");
          },
          function (error) {
             self.handleError ("cylon", error);
          }
       );
   },

   init: function (chatter, config, strings, bot) {
      var self = this;

      // Rainbow effect on a new follower
      followers.on ('followed', function (followers) {
         self.rainbow ();
      });

      // Pulse when someone joins
      chatter.on ('joined', function (nickname) {
         self.pulse ();
      });

      // Chatter when someone types a message
      chatter.on ('chat', function (data) {
         self.chatter ();
      });

      self.help = strings.get ('help-hat');

      // Init the connection to the Particle Cloud
      self.particle = new Particle ();
      self.particle.login ({username: config ['particle-cloud-username'], password: config ['particle-cloud-password']}).then (
         function (data) {
            winston.info ("Sucessfully connected to Particle Cloud as " + config ['particle-cloud-username']);
            self.particle_access_token = data.body.access_token;
            self.particle_device_id = config ['particle-hat-device-id'];
         },
         function (error) {
             winston.error ("Error connecting to Particle Cloud, hat functions unavailable.", error);
         });


      bot.on( 'command!hat', function (channel, text, nickname, stanza) {
         winston.debug ("Running the hat command");

         var cr = false;      // was the command run
         if (text.length === 0 || text.indexOf ('pulse') >= 0) {
            // pulse
            self.pulse ();
            cr = true;
         } else if (text.indexOf ('rainbow') >= 0) {
            self.rainbow ();
            cr = true;
         } else if (text.indexOf ('color') >= 0) {
            // Parse the color value
            var match = text.match (/0x[0-9A-F]{1,8}/gi);
            if (match && match.length > 0) {
               self.color (match [0]);
               cr = true;
            } else {
               // Random color
               var r = Math.floor (Math.random () * 255);
               var g = Math.floor (Math.random () * 255);
               var b = Math.floor (Math.random () * 255);

               var zero = '0'.charCodeAt (0);
               var ay = 'A'.charCodeAt (0);
               var hex = function (v) {
                  if (v < 10) {
                     return String.fromCharCode (zero + v);
                  } else {
                     return String.fromCharCode (ay + (v - 10));
                  }
               };

               var c = "0x00" + hex ((r >> 4) & 0xf) + hex (r & 0xf)
                              + hex ((g >> 4) & 0xf) + hex (g & 0xf)
                              + hex ((b >> 4) & 0xf) + hex (b & 0xf);

               self.color (c);
            }
         } else if (text.indexOf ('cylon') >= 0) {
            // Parse the color value
            var match = text.match (/0x[0-9A-F]{1,8}/gi);
            if (match && match.length > 0) {
               self.cylon (match [0]);
               cr = true;
            } else {
               self.cylon ('0xff0000');      // default to red
               cr = true;
            }
         }

         if (cr) {
            var message = "Running the hat command.";
            bot.message (channel, message);
         }
      });
   }
};



