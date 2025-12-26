import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-analytics.js";
  
const firebaseConfig = {
    apiKey: "AIzaSyBjYlotSgCbybRBNQi9iHbadjkbXDY9AhE",
    authDomain: "bebeji-plaza-63d7b.firebaseapp.com",
    databaseURL: "https://bebeji-plaza-63d7b-default-rtdb.firebaseio.com",
    projectId: "bebeji-plaza-63d7b",
    storageBucket: "bebeji-plaza-63d7b.firebasestorage.app",
    messagingSenderId: "836349091408",
    appId: "1:836349091408:web:5b24bc3f4857a376c17b55",
    measurementId: "G-91KC7J6MWJ"
  };


const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);


export { app, analytics, firebaseConfig };
