// Конфигурация Firebase — вставьте ваши значения из консоли Firebase
const firebaseConfig = {
  apiKey: "AIzaSyASictZbABPLhXrXv2mxyMfuuWRqycIO8k",
  authDomain: "site-course.firebaseapp.com",
  projectId: "site-course",
  storageBucket: "site-course.firebasestorage.app",
  messagingSenderId: "631598537694",
  appId: "1:631598537694:web:5b9393031e1f37c16c5b4f"
};

// Инициализация Firebase — ЭТА СТРОКА ОБЯЗАТЕЛЬНА!
// Без неё firebase.auth() и firebase.firestore() выбрасывают ошибку:
// "No Firebase App '[DEFAULT]' has been created - call Firebase App.initializeApp()"
firebase.initializeApp(firebaseConfig);

// Делаем конфиг доступным глобально (на случай если понадобится)
if (typeof window !== 'undefined') {
  window.firebaseConfig = firebaseConfig;
}
