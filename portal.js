// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBSbonwVE3PPXIIrSrvrB75u2AQ_B_Tni4",
  authDomain: "discraft-c1c41.firebaseapp.com",
  databaseURL: "https://discraft-c1c41-default-rtdb.firebaseio.com",
  projectId: "discraft-c1c41",
  storageBucket: "discraft-c1c41.appspot.com",
  messagingSenderId: "525620150766",
  appId: "1:525620150766:web:a426e68d206c68764aceff",
  measurementId: "G-2TRNRYRX5E"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const slotBookingDB = firebase.database().ref("slotBookings");

// Handle form submission
document.getElementById("slotBookingForm").addEventListener("submit", function (event) {
  event.preventDefault();

  const userName = getElementVal("userName");
  const dateRange = getElementVal("dateRangeSelect");
  const day = getElementVal("daySelect");
  const role = getElementVal("roleSelect");
  const number = getElementVal("number");

  if (!userName || !dateRange || !day || !role || !number) {
      alert("All fields are required!");
      return;
  }

  checkSlotAvailability(dateRange, day, role, userName, number);
});

// Check if the slot is available
function checkSlotAvailability(dateRange, day, role, userName, number) {
  const slotRef = slotBookingDB.child(`${dateRange}/${day}/${role}`);

  slotRef.once("value", (snapshot) => {
      if (snapshot.exists()) {
          alert("This slot is already booked! Please choose another slot.");
      } else {
          saveBooking(userName, dateRange, day, role, number);
      }
  });
}

// Save booking to Firebase
function saveBooking(userName, dateRange, day, role, number) {
  const slotRef = slotBookingDB.child(`${dateRange}/${day}/${role}`);

  slotRef.set({
      userName: userName,
      number: number
  }).then(() => {
      document.querySelector(".alert").style.display = "block";

      setTimeout(() => {
          document.querySelector(".alert").style.display = "none";
      }, 3000);

      document.getElementById("slotBookingForm").reset();
      displaySlotAvailability();
  }).catch((error) => {
      console.error("Error saving data:", error);
      alert("An error occurred while saving the booking.");
  });
}

// Display availability
function displaySlotAvailability() {
  const dateRanges = ["Dec16-Dec22", "Dec23-Dec29"];
  const slotAvailabilityContainer = document.getElementById("slotAvailability");

  slotAvailabilityContainer.innerHTML = "";

  dateRanges.forEach((dateRange) => {
      const dateRangeDiv = document.createElement("div");
      dateRangeDiv.classList.add("dateRangeDetails");

      const dateRangeTitle = document.createElement("h3");
      dateRangeTitle.innerText = dateRange.replace("-", " - ");
      dateRangeDiv.appendChild(dateRangeTitle);

      const slotList = document.createElement("ul");
      dateRangeDiv.appendChild(slotList);

      const slotRef = slotBookingDB.child(dateRange);

      slotRef.once("value", (snapshot) => {
          if (snapshot.exists()) {
              snapshot.forEach((daySnapshot) => {
                  const dayName = daySnapshot.key;
                  daySnapshot.forEach((roleSnapshot) => {
                      const roleName = roleSnapshot.key;
                      const slotData = roleSnapshot.val();

                      const slotItem = document.createElement("li");
                      const whatsappLink = `https://wa.me/+91${slotData.number}`;
                      // slotItem.innerHTML = `${dayName}: ${roleName} booked by <a href="${whatsappLink}" target="_blank">${slotData.userName}</a>`;
                      slotItem.innerHTML = `
                      <span>${dayName}: ${roleName} booked by ${slotData.userName}</span>
                      <a href="${whatsappLink}" target="_blank">${slotData.userName}</a>`;
                      slotList.appendChild(slotItem);
                  });
              });
          } else {
              const noSlotsMessage = document.createElement("li");
              noSlotsMessage.innerText = "No bookings yet for this date range.";
              slotList.appendChild(noSlotsMessage);
          }
      });

      slotAvailabilityContainer.appendChild(dateRangeDiv);
  });
}

// Helper function to get input values
function getElementVal(id) {
  return document.getElementById(id).value;
}

// Populate availability on page load
window.onload = displaySlotAvailability;



/* background */
/*          *     .        *  .    *    *   . 
.  *  move your mouse to over the stars   .
*  .  .   change these values:   .  *
 .      * .        .          * .       */
 const STAR_COLOR = '#fff';
 const STAR_SIZE = 3;
 const STAR_MIN_SCALE = 0.2;
 const OVERFLOW_THRESHOLD = 50;
 const STAR_COUNT = ( window.innerWidth + window.innerHeight ) / 8;
 
 const canvas = document.querySelector( 'canvas' ),
       context = canvas.getContext( '2d' );
 
 let scale = 1, // device pixel ratio
     width,
     height;
 
 let stars = [];
 
 let pointerX,
     pointerY;
 
 let velocity = { x: 0, y: 0, tx: 0, ty: 0, z: 0.0005 };
 
 let touchInput = false;
 
 generate();
 resize();
 step();
 
 window.onresize = resize;
 canvas.onmousemove = onMouseMove;
 canvas.ontouchmove = onTouchMove;
 canvas.ontouchend = onMouseLeave;
 document.onmouseleave = onMouseLeave;
 
 function generate() {
 
    for( let i = 0; i < STAR_COUNT; i++ ) {
     stars.push({
       x: 0,
       y: 0,
       z: STAR_MIN_SCALE + Math.random() * ( 1 - STAR_MIN_SCALE )
     });
    }
 
 }
 
 function placeStar( star ) {
 
   star.x = Math.random() * width;
   star.y = Math.random() * height;
 
 }
 
 function recycleStar( star ) {
 
   let direction = 'z';
 
   let vx = Math.abs( velocity.x ),
         vy = Math.abs( velocity.y );
 
   if( vx > 1 || vy > 1 ) {
     let axis;
 
     if( vx > vy ) {
       axis = Math.random() < vx / ( vx + vy ) ? 'h' : 'v';
     }
     else {
       axis = Math.random() < vy / ( vx + vy ) ? 'v' : 'h';
     }
 
     if( axis === 'h' ) {
       direction = velocity.x > 0 ? 'l' : 'r';
     }
     else {
       direction = velocity.y > 0 ? 't' : 'b';
     }
   }
   
   star.z = STAR_MIN_SCALE + Math.random() * ( 1 - STAR_MIN_SCALE );
 
   if( direction === 'z' ) {
     star.z = 0.1;
     star.x = Math.random() * width;
     star.y = Math.random() * height;
   }
   else if( direction === 'l' ) {
     star.x = -OVERFLOW_THRESHOLD;
     star.y = height * Math.random();
   }
   else if( direction === 'r' ) {
     star.x = width + OVERFLOW_THRESHOLD;
     star.y = height * Math.random();
   }
   else if( direction === 't' ) {
     star.x = width * Math.random();
     star.y = -OVERFLOW_THRESHOLD;
   }
   else if( direction === 'b' ) {
     star.x = width * Math.random();
     star.y = height + OVERFLOW_THRESHOLD;
   }
 
 }
 
 function resize() {
 
   scale = window.devicePixelRatio || 1;
 
   width = window.innerWidth * scale;
   height = window.innerHeight * scale;
 
   canvas.width = width;
   canvas.height = height;
 
   stars.forEach( placeStar );
 
 }
 
 function step() {
 
   context.clearRect( 0, 0, width, height );
 
   update();
   render();
 
   requestAnimationFrame( step );
 
 }
 
 function update() {
 
   velocity.tx *= 0.5;
   velocity.ty *= 0.5;
 
   velocity.x += ( velocity.tx - velocity.x ) * 0.8;
   velocity.y += ( velocity.ty - velocity.y ) * 0.8;
 
   stars.forEach( ( star ) => {
 
     star.x += velocity.x * star.z;
     star.y += velocity.y * star.z;
 
     star.x += ( star.x - width/2 ) * velocity.z * star.z;
     star.y += ( star.y - height/2 ) * velocity.z * star.z;
     star.z += velocity.z;
   
     // recycle when out of bounds
     if( star.x < -OVERFLOW_THRESHOLD || star.x > width + OVERFLOW_THRESHOLD || star.y < -OVERFLOW_THRESHOLD || star.y > height + OVERFLOW_THRESHOLD ) {
       recycleStar( star );
     }
 
   } );
 
 }
 
 function render() {
 
   stars.forEach( ( star ) => {
 
     context.beginPath();
     context.lineCap = 'round';
     context.lineWidth = STAR_SIZE * star.z * scale;
     context.globalAlpha = 0.5 + 0.5*Math.random();
     context.strokeStyle = STAR_COLOR;
 
     context.beginPath();
     context.moveTo( star.x, star.y );
 
     var tailX = velocity.x * 2,
         tailY = velocity.y * 2;
 
     // stroke() wont work on an invisible line
     if( Math.abs( tailX ) < 0.1 ) tailX = 0.5;
     if( Math.abs( tailY ) < 0.1 ) tailY = 0.5;
 
     context.lineTo( star.x + tailX, star.y + tailY );
 
     context.stroke();
 
   } );
 
 }
 
 function movePointer( x, y ) {
 
   if( typeof pointerX === 'number' && typeof pointerY === 'number' ) {
 
     let ox = x - pointerX,
         oy = y - pointerY;
 
     velocity.tx = velocity.tx + ( ox / 8*scale ) * ( touchInput ? 1 : -1 );
     velocity.ty = velocity.ty + ( oy / 8*scale ) * ( touchInput ? 1 : -1 );
 
   }
 
   pointerX = x;
   pointerY = y;
 
 }
 
 function onMouseMove( event ) {
 
   touchInput = false;
 
   movePointer( event.clientX, event.clientY );
 
 }
 
 function onTouchMove( event ) {
 
   touchInput = true;
 
   movePointer( event.touches[0].clientX, event.touches[0].clientY, true );
 
   event.preventDefault();
 
 }
 
 function onMouseLeave() {
 
   pointerX = null;
   pointerY = null;
 
 }
 