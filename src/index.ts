import { $query, $update, Record, StableBTreeMap, Vec, match, Result, nat64, ic, Opt, Principal } from 'azle';
import { v4 as uuidv4 } from 'uuid';

// Define the structure of a Word
type Word = Record<{
    id: string;
    word: string;
    meaning: string;
    difficulty: nat64;
    creator: Principal;
    created_at: nat64;
    updated_at: Opt<nat64>;
}>;

// Define the structure of a VocabularyList
type VocabularyList = Record<{
    id: string;
    name: string;
    words: Vec<Word>;
    creator: Principal;
    created_at: nat64;
    updated_at: Opt<nat64>;
}>;

// Define the structure of a WordPayload
type WordPayload = Record<{
    word: string;
    meaning: string;
    difficulty: nat64;
}>;

// Create storage for words and vocabulary lists
const wordStorage = new StableBTreeMap<string, Word>(0, 44, 512);
const listStorage = new StableBTreeMap<string, VocabularyList>(1, 44, 512);

// Function to add a Vocabulary List
$update
export function addVocabularyList(name: string): Result<VocabularyList, string> {
    try {
        // Validate name
        if (typeof name !== 'string' || name.trim() === '') {
            return Result.Err<VocabularyList, string>('Invalid name');
        }

        const newVocabularyList: VocabularyList = {
            id: uuidv4(),
            name,
            words: [],
            creator: ic.caller(),
            created_at: ic.time(),
            updated_at: Opt.None
        };

        // Insert the new vocabulary list into the storage
        listStorage.insert(newVocabularyList.id, newVocabularyList);
        return Result.Ok<VocabularyList, string>(newVocabularyList);
    } catch (error) {
        return Result.Err<VocabularyList, string>('Issue encountered when creating Vocabulary List');
    }
}

// Function to update a Vocabulary List
$update
export function updateVocabularyList(id: string, name: string): Result<VocabularyList, string> {
    // Validate ID and name
    if (typeof id !== 'string' || typeof name !== 'string' || name.trim() === '') {
        return Result.Err<VocabularyList, string>('Invalid ID or name');
    }

    return match(listStorage.get(id), {
        Some: (vocabularyList) => {
            // Authorization of the user
            if (vocabularyList.creator.toString() !== ic.caller().toString()) {
                return Result.Err<VocabularyList, string>('You are not authorized to access the Vocabulary List');
            }

            // Update the Vocabulary List
            const updatedVocabularyList: VocabularyList = { ...vocabularyList, name, updated_at: Opt.Some(ic.time()) };
            listStorage.insert(vocabularyList.id, updatedVocabularyList);
            return Result.Ok<VocabularyList, string>(updatedVocabularyList);
        },
        None: () => Result.Err<VocabularyList, string>(`Vocabulary List with ID=${id} not found`)
    });
}


// Initialize the number of words to list
const initWords = 5;

// get the first 5 words from the list
$query
export function getInitialWords(): Result<Vec<Word>, string> {
    try {
        const initialWords = wordStorage.values().slice(0, initWords);
        return Result.Ok(initialWords);
    } catch (error) {
        return Result.Err<string, string>(`Error retrieving initial words: ${error}`);
    }
}

// get all words from the list
$query
export function getAllWords(): Result<Vec<Word>, string> {
    try {
        const allWords = wordStorage.values();
        return Result.Ok(allWords);
    } catch (error) {
        return Result.Err<string, string>(`Error retrieving all words: ${error}`);
    }
}

// get all lists
$query
export function getAllLists(): Result<Vec<VocabularyList>, string> {
    try {
        const allLists = listStorage.values();
        return Result.Ok(allLists);
    } catch (error) {
        return Result.Err<string, string>(`Error retrieving all lists: ${error}`);
    }
}


// get a list by id
$query
export function getListById(id: string): Result<VocabularyList, string> {
    try {
        // ID Validation
        if (typeof id !== 'string' || id.trim() === '') {
            return Result.Err<VocabularyList, string>('Invalid ID');
        }

        return match(listStorage.get(id), {
            Some: (list) => {
                // Authorization Check
                if (list.creator.toString() !== ic.caller().toString()) {
                    return Result.Err<VocabularyList, string>('Unauthorized access to Vocabulary list');
                }

                return Result.Ok<VocabularyList, string>(list);
            },
            None: () => Result.Err<VocabularyList, string>(`The List with id =${id} not available`),
        });
    } catch (error) {
        return Result.Err<VocabularyList, string>(`Error while retrieving the Vocabulary list: ${error}`);
    }
}

// delete a list by id
$update
export function deleteListById(id: string): Result<string, string> {
    try {
        // ID Validation
        if (typeof id !== 'string' || id.trim() === '') {
            return Result.Err<string, string>('Invalid ID');
        }

        return match(listStorage.get(id), {
            Some: (list) => {
                // Authorization Check
                if (list.creator.toString() !== ic.caller().toString()) {
                    return Result.Err<string, string>('Unauthorized access to Vocabulary list');
                }

                listStorage.remove(id);
                return Result.Ok<string, string>(`List with id = ${id} deleted successfully`);
            },
            None: () => Result.Err<string, string>(`The List with id =${id} not available`),
        });
    } catch (error) {
        return Result.Err<string, string>(`Error while deleting the Vocabulary list: ${error}`);
    }
}


// Function to add a word to a list
$update
export function addWordToList(id: string, payload: WordPayload): Result<Word, string> {
    // Validate ID
    if (typeof id !== 'string') {
        return Result.Err<Word, string>('Invalid list ID');
    }

    try {
        // Validate payload properties
        if (
            typeof payload.word !== 'string' ||
            payload.word.trim() === '' ||
            typeof payload.meaning !== 'string' ||
            typeof payload.difficulty !== 'number'
        ) {
            return Result.Err<Word, string>('Invalid word payload');
        }

        return match(listStorage.get(id), {
            Some: (list) => {
                // Authorization of the user
                if (list.creator.toString() !== ic.caller().toString()) {
                    return Result.Err<Word, string>('Unauthorized access to Vocabulary list');
                }

                const newWord: Word = {
                    id: uuidv4(),
                    word: payload.word,
                    meaning: payload.meaning,
                    difficulty: payload.difficulty,
                    creator: ic.caller(),
                    created_at: ic.time(),
                    updated_at: Opt.None
                };

                // Insert the new word into the storage and the list
                wordStorage.insert(newWord.id, newWord);
                list.words.push(newWord);
                listStorage.insert(list.id, list);

                return Result.Ok<Word, string>(newWord);
            },
            None: () => Result.Err<Word, string>(`Vocabulary List with ID=${id} not available`)
        });
    } catch (error) {
        return Result.Err<Word, string>(`Failed to

 add word to the list: ${error}`);
    }
}

// Function to update a word in a list
$update
export function updateWordInList(listId: string, wordId: string, payload: WordPayload): Result<Word, string> {
    // Validate list ID and word ID
    if (typeof listId !== 'string' || typeof wordId !== 'string') {
        return Result.Err<Word, string>('Invalid list ID or word ID');
    }

    return match(listStorage.get(listId), {
        Some: (list) => {
            // Authorization of the user
            if (list.creator.toString() !== ic.caller().toString()) {
                return Result.Err<Word, string>('Unauthorized access to Vocabulary list');
            }

            try {
                // Validate payload properties
                if (
                    typeof payload.word !== 'string' ||
                    payload.word.trim() === '' ||
                    typeof payload.meaning !== 'string' ||
                    typeof payload.difficulty !== 'number'
                ) {
                    return Result.Err<Word, string>('Invalid word payload');
                }

                // Update the word in the list
                const updatedWord: Word = {
                    id: wordId,
                    word: payload.word,
                    meaning: payload.meaning,
                    difficulty: payload.difficulty,
                    creator: ic.caller(),
                    created_at: ic.time(),
                    updated_at: Opt.Some(ic.time())
                };

                // Insert the updated word into the storage and update the list
                wordStorage.insert(updatedWord.id, updatedWord);
                list.words = list.words.map((word) => (word.id === wordId ? updatedWord : word));
                listStorage.insert(list.id, list);

                return Result.Ok<Word, string>(updatedWord);
            } catch (error) {
                return Result.Err<Word, string>(`Failed to update word in the list: ${error}`);
            }
        },
        None: () => Result.Err<Word, string>(`Vocabulary List with ID=${listId} not available`)
    });
}

// Function to delete a word from a list
$update
export function deleteWordFromList(listId: string, wordId: string): Result<string, string> {
    // Validate list ID and word ID
    if (typeof listId !== 'string' || typeof wordId !== 'string') {
        return Result.Err<string, string>('Invalid list ID or word ID');
    }

    return match(listStorage.get(listId), {
        Some: (list) => {
            // Authorization of the user
            if (list.creator.toString() !== ic.caller().toString()) {
                return Result.Err<string, string>('Unauthorized access to Vocabulary list');
            }

            try {
                // Delete the word from the list
                list.words = list.words.filter((word) => word.id !== wordId);
                listStorage.insert(list.id, list);

                // Remove the word from the storage
                wordStorage.remove(wordId);

                return Result.Ok<string, string>(`Word with ID=${wordId} deleted successfully`);
            } catch (error) {
                return Result.Err<string, string>(`Failed to delete word from the list: ${error}`);
            }
        },
        None: () => Result.Err<string, string>(`Vocabulary List with ID=${listId} not available`)
    });
}

// Function to get a word from a list
$query
export function getWordFromList(listId: string, wordId: string): Result<Word, string> {
    // Validate list ID and word ID
    if (typeof listId !== 'string' || typeof wordId !== 'string') {
        return Result.Err<Word, string>('Invalid list ID or word ID');
    }

    return match(listStorage.get(listId), {
        Some: (list) => {
            // Authorization of the user
            if (list.creator.toString() !== ic.caller().toString()) {
                return Result.Err<Word, string>('Unauthorized access to Vocabulary list');
            }

            // Find the word in the list
            const word = list.words.find((word) => word.id === wordId);
            if (word) {
                return Result.Ok<Word, string>(word);
            }

            return Result.Err<Word, string>(`Word with ID=${wordId} not found`);
        },
        None: () => Result.Err<Word, string>(`Vocabulary List with ID=${listId} not available`)
    });
}

// Function to count the number of words in a list
$query
export function countWordsInList(id: string): Result<number, string> {
    // Validate list ID
    if (typeof id !== 'string') {
        return Result.Err<number, string>('Invalid list ID');
    }

    return match(listStorage.get(id), {
        Some: (list) => {
            // Authorization of the user
            if (list.creator.toString() !== ic.caller().toString()) {
                return Result.Err<number, string>('Unauthorized access to Vocabulary list');
            }

            // Return the count of words in the list
            return Result.Ok<number, string>(list.words.length);
        },
        None: () => Result.Err<number, string>(`Vocabulary List with ID=${id} not available`)
    });
}

// Function to change the difficulty level of a word
$update
export function changeDifficultyOfWord(wordId: string, difficulty: nat64): Result<Word, string> {
    // Validate word ID
    if (typeof wordId !== 'string') {
        return Result.Err<Word, string>('Invalid word ID');
    }

    return match(wordStorage.get(wordId), {
        Some: (word) => {
            // Authorization of the user
            if (word.creator.toString() !== ic.caller().toString()) {
                return Result.Err<Word, string>('Unauthorized access to Vocabulary list');
            }

            try {
                // Update the difficulty level of the word
                const updatedWord: Word = {
                    ...word,
                    difficulty,
                    updated_at: Opt.Some(ic.time())
                };

                // Insert the updated word into the storage
                wordStorage.insert(updatedWord.id, updatedWord);

                return Result.Ok<Word, string>(updatedWord);
            } catch (error) {
                return Result.Err<Word, string>(`Failed to change the difficulty level of the word: ${error}`);
            }
        },
        None: () => Result.Err<Word, string>(`The Word with ID=${wordId} not available`)
    });
}

// Function to get words by difficulty
$query
export function getWordsByDifficulty(difficulty: nat64): Result<Vec<Word>, string> {
    try {
        // Validate difficulty level
        if (typeof difficulty !== 'number') {
            return Result.Err<Vec<Word>, string>('Invalid difficulty level');
        }

        // Filter words by difficulty level and return the result
        const words = wordStorage.values().filter((word) => word.difficulty === difficulty);
        return Result.Ok(words);
    } catch (error) {
        return Result.Err<Vec<Word>, string>(`Failed to retrieve words by difficulty: ${error}`);
    }
}


// UUID workaround
globalThis.crypto = {
    // @ts-ignore
    getRandomValues: () => {
        let array = new Uint8Array(32);

        for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
        }

        return array;
    },
};

