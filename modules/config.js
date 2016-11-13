//
// The config module reads in the config.json file and sets properties on a singleton to be
// used throughout the code.
//

var __approot = require('app-root-path');

function Config () {
}

Config.prototype.init = function init (root) {
   var config = require (__approot + '/config.json')[root];
   for (var property in config) {
      if (config.hasOwnProperty (property)) {
         Object.defineProperty (this, property, { value: config [property], writable: false, enumerable : true, configurable : false} );
      }
   }
};

module.exports = exports = new Config ();
