
import {initializeApp} from 'firebase/app';
import {getFirestore, collection, getDocs, doc, runTransaction, query, where, orderBy} from 'firebase/firestore';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env file at the root of the project
config({ path: resolve(__dirname, '../../.env') });

// IMPORTANT: Paste your Firebase project configuration here.
// You can find this in your Firebase project settings.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const STARTING_ID = 100001;

async function assignClientIds() {
  console.log('Starting script to assign client IDs...');

  try {
    await runTransaction(db, async (transaction) => {
      // 1. Get the current counter value
      const counterRef = doc(db, 'counters', 'userCounter');
      const counterSnap = await transaction.get(counterRef);
      let nextId = counterSnap.exists() ? counterSnap.data().lastId + 1 : STARTING_ID;

      // 2. Find all users without a clientId
      const usersRef = collection(db, 'users');
      // We must query for users who DO have a clientId to compare against those who don't.
      // Firestore doesn't have a "does not exist" or "is null" query for this case.
      // A more robust way is to fetch all and filter in memory.
      console.log('Fetching all user documents...');
      const allUsersSnapshot = await getDocs(query(usersRef, orderBy('createdAt')));
      
      const usersWithoutClientId = allUsersSnapshot.docs.filter(doc => !doc.data().clientId);

      if (usersWithoutClientId.length === 0) {
        console.log('All users already have a client ID. No action needed.');
        return;
      }

      console.log(`Found ${usersWithoutClientId.length} users without a client ID. Assigning IDs now...`);

      // 3. Assign new IDs to them
      for (const userDoc of usersWithoutClientId) {
        const userRef = doc(db, 'users', userDoc.id);
        transaction.update(userRef, { clientId: nextId });
        console.log(`Assigning Client ID ${nextId} to user ${userDoc.id}`);
        nextId++;
      }

      // 4. Update the counter with the new lastId
      const newLastId = nextId - 1;
      transaction.set(counterRef, { lastId: newLastId }, { merge: true });
      console.log(`Counter updated to ${newLastId}.`);
    });

    console.log('Script finished successfully. All users now have a client ID.');
  } catch (error) {
    console.error('An error occurred during the transaction:', error);
    console.log('Script failed. Please check the error message and try again.');
  }
}

assignClientIds().then(() => {
    console.log("Exiting script.");
    // In Node.js environment, you might want to explicitly exit
    // process.exit(0);
}).catch(e => {
    console.error("Unhandled error in script:", e);
    // process.exit(1);
});
