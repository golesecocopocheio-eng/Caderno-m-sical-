/* Configuração do Firebase (sincronização entre celulares) — projeto bar-conect, conta do bar.
 * Esses valores não são senha: o Firebase foi feito para eles ficarem no site.
 * Quem protege os dados são as regras do Firestore (firestore.rules) e o código do bar.
 * Sem databaseURL o app usa o Firestore; com databaseURL, o Realtime Database. */
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyDF2I6-fmzCoUT94AarlpOCoUE2SehuJFE",
  authDomain: "bar-conect.firebaseapp.com",
  projectId: "bar-conect",
  storageBucket: "bar-conect.firebasestorage.app",
  messagingSenderId: "425254552296",
  appId: "1:425254552296:web:526f7e7f04bfd7505d7f5d"
};
