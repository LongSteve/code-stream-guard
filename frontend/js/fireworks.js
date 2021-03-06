//
// Thanks to http://thecodeplayer.com/walkthrough/canvas-fireworks-tutorial for the canvas
// fireworks code.  Created by http://twitter.com/jackrugile with some slight adjustments
// by me.
//

var looping = false;
var fw_time_remaining_ms = 0;
var fw_loop_last_ms = 0;

// Start the fireworks, and continue for a certain duration
function startFireworks (duration) {

   // If the fireworks are currently going off, just add to the time
   if (fw_time_remaining_ms >= 0) {
      fw_time_remaining_ms += duration;
   } else {
      fw_time_remaining_ms = duration;
   }

   // Clear this to remove any large delay between loops, while it's stopped
   fw_loop_last_ms = 0;

   // Trigger the loop if necesaary
   if (!looping) {
      looping = true;
      loop ();
   }
};

// when animating on canvas, it is best to use requestAnimationFrame instead of setTimeout or setInterval
// not supported in all browsers though and sometimes needs a prefix, so we need a shim
window.requestAnimFrame = (function () {
   return window.requestAnimationFrame ||
          window.webkitRequestAnimationFrame ||
          window.mozRequestAnimationFrame ||
          function (callback) {
      window.setTimeout (callback, 1000 / 30);
   };
}) ();

// now we will setup our basic variables for the demo
var canvas = document.getElementById ('fireworksCanvas'),
   ctx = canvas.getContext ('2d'),
   // full screen dimensions
   cw = window.innerWidth,
   ch = window.innerHeight,
   // firework collection
   fireworks = [ ],
   // particle collection
   particles = [ ],
   // starting hue
   hue = 120,
   // this will time the auto launches of fireworks, one launch per 80 loop ticks
   timerTotal = 20,
   timerTick = 0;

// set canvas dimensions
canvas.width = cw;
canvas.height = ch;

// now we are going to setup our function placeholders for the entire demo

// get a random number within a range
function random (min, max) {
   return Math.random () * (max - min) + min;
}

// calculate the distance between two points
function calculateDistance (p1x, p1y, p2x, p2y) {
   var xDistance = p1x - p2x,
      yDistance = p1y - p2y;
   return Math.sqrt (Math.pow (xDistance, 2) + Math.pow (yDistance, 2));
}

// create firework
function Firework (sx, sy, tx, ty) {
   // actual coordinates
   this.x = sx;
   this.y = sy;
   // starting coordinates
   this.sx = sx;
   this.sy = sy;
   // target coordinates
   this.tx = tx;
   this.ty = ty;
   // distance from starting point to target
   this.distanceToTarget = calculateDistance (sx, sy, tx, ty);
   this.distanceTraveled = 0;
   // track the past coordinates of each firework to create a trail effect, increase the coordinate count to create more prominent trails
   this.coordinates = [ ];
   this.coordinateCount = 3;
   // populate initial coordinate collection with the current coordinates
   while (this.coordinateCount--) {
      this.coordinates.push ( [ this.x, this.y ]);
   }
   this.angle = Math.atan2 (ty - sy, tx - sx);
   this.speed = 2;
   this.acceleration = 1.05;
   this.brightness = random (50, 70);
   // circle target indicator radius
   this.targetRadius = 1;
}

// update firework
Firework.prototype.update = function (index) {
   // remove last item in coordinates array
   this.coordinates.pop ();
   // add current coordinates to the start of the array
   this.coordinates.unshift ( [ this.x, this.y ]);

   // cycle the circle target indicator radius
   this.targetRadius += 0.15;
   if (this.targetRadius > 4) {
      this.targetRadius = -4.0;
   }

   // speed up the firework
   this.speed *= this.acceleration;

   // get the current velocities based on angle and speed
   var vx = Math.cos (this.angle) * this.speed,
      vy = Math.sin (this.angle) * this.speed;
   // how far will the firework have traveled with velocities applied?
   this.distanceTraveled = calculateDistance (this.sx, this.sy, this.x + vx, this.y + vy);

   // if the distance traveled, including velocities, is greater than the initial distance to the target, then the target has been reached
   if (this.distanceTraveled >= this.distanceToTarget) {
      createParticles (this.tx, this.ty);
      // remove the firework, use the index passed into the update function to determine which to remove
      fireworks.splice (index, 1);
   } else {
      // target not reached, keep traveling
      this.x += vx;
      this.y += vy;
   }
}

   // draw firework
   Firework.prototype.draw = function () {
   ctx.beginPath ();
   // move to the last tracked coordinate in the set, then draw a line to the current x and y
   ctx.moveTo (this.coordinates[this.coordinates.length - 1][0], this.coordinates[this.coordinates.length - 1][1]);
   ctx.lineTo (this.x, this.y);
   ctx.strokeStyle = 'hsl(' + hue + ', 100%, ' + this.brightness + '%)';
   ctx.stroke ();

   ctx.beginPath ();
   // draw the target for this firework with a pulsing circle
   ctx.arc (this.tx, this.ty, Math.abs (this.targetRadius), 0, Math.PI * 2);
   ctx.stroke ();
}

   // create particle
   function Particle (x, y) {
   this.x = x;
   this.y = y;
   // track the past coordinates of each particle to create a trail effect, increase the coordinate count to create more prominent trails
   this.coordinates = [ ];
   this.coordinateCount = 5;
   while (this.coordinateCount--) {
      this.coordinates.push ( [ this.x, this.y ]);
   }
   // set a random angle in all possible directions, in radians
   this.angle = random (0, Math.PI * 2);
   this.speed = random (1, 8);
   // friction will slow the particle down
   this.friction = 0.95;
   // gravity will be applied and pull the particle down
   this.gravity = 1;
   // set the hue to a random number +-20 of the overall hue variable
   this.hue = random (hue - 20, hue + 20);
   this.brightness = random (50, 80);
   this.alpha = 1;
   // set how fast the particle fades out
   this.decay = random (0.015, 0.03);
}

// update particle
Particle.prototype.update = function (index) {
   // remove last item in coordinates array
   this.coordinates.pop ();
   // add current coordinates to the start of the array
   this.coordinates.unshift ( [ this.x, this.y ]);
   // slow down the particle
   this.speed *= this.friction;
   // apply velocity
   this.x += Math.cos (this.angle) * this.speed;
   this.y += Math.sin (this.angle) * this.speed + this.gravity;
   // fade out the particle
   this.alpha -= this.decay;

   // remove the particle once the alpha is low enough, based on the passed in index
   if (this.alpha <= this.decay) {
      particles.splice (index, 1);
   }
}

   // draw particle
   Particle.prototype.draw = function () {
   ctx.beginPath ();
   // move to the last tracked coordinates in the set, then draw a line to the current x and y
   ctx.moveTo (this.coordinates[this.coordinates.length - 1][0], this.coordinates[this.coordinates.length - 1][1]);
   ctx.lineTo (this.x, this.y);
   ctx.strokeStyle = 'hsla(' + this.hue + ', 100%, ' + this.brightness + '%, ' + this.alpha + ')';
   ctx.stroke ();
}

   // create particle group/explosion
   function createParticles (x, y) {
   // increase the particle count for a bigger explosion, beware of the canvas performance hit with the increased particles though
   var particleCount = 30;
   while (particleCount--) {
      particles.push (new Particle (x, y));
   }
}

// main demo loop
function loop () {

   // this function will run endlessly with requestAnimationFrame
   if (looping) {
      // Stop the loop when no time left, and all fireworks and particles have died
      if (fw_time_remaining_ms <= 0 && fireworks.length === 0 && particles.length === 0) {
         looping = false;
         fw_time_remaining_ms = 0;
         fw_loop_last_ms = 0;
         return;
      } else {
         requestAnimFrame (loop);
      }
   }

   if (fw_loop_last_ms === 0) {
      fw_loop_last_ms = Date.now ();
   }

   var now_ms = Date.now ();

   // Subtract millis since last loop tick
   fw_time_remaining_ms -= (now_ms - fw_loop_last_ms);
   fw_loop_last_ms = now_ms;

   // increase the hue to get different colored fireworks over time
   hue += 0.5;

   // normally, clearRect() would be used to clear the canvas
   // we want to create a trailing effect though
   // setting the composite operation to destination-out will allow us to clear the canvas at a specific opacity, rather than wiping it entirely
   ctx.globalCompositeOperation = 'destination-out';
   // decrease the alpha property to create more prominent trails
   ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
   ctx.fillRect (0, 0, cw, ch);
   // change the composite operation back to our main mode
   // lighter creates bright highlight points as the fireworks and particles overlap each other
   ctx.globalCompositeOperation = 'lighter';

   // loop over each firework, draw it, update it
   var i = fireworks.length;
   while (i--) {
      fireworks[i].draw ();
      fireworks[i].update (i);
   }

   // loop over each particle, draw it, update it
   var i = particles.length;
   while (i--) {
      particles[i].draw ();
      particles[i].update (i);
   }

   // launch fireworks automatically to random coordinates
   if (timerTick >= timerTotal) {
      // start the firework at the bottom middle of the screen,
      // then set the random target coordinates, the random y coordinates
      // will be set within the range of the top half of the screen
      if (fw_time_remaining_ms > 0) {
         fireworks.push (new Firework (cw / 2, ch, random (0, cw), random (0, ch / 2)));
      }
      timerTick = 0;
   } else {
      timerTick++;
   }
}

