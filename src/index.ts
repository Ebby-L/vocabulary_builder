import { $query, $update, Record, StableBTreeMap, Vec, match, Result, nat64, ic, Opt, Principal} from 'azle';
import { v4 as uuidv4 } from 'uuid';

type Word = Record<{
    id: string;
    word: string;
    meaning: string;
    difficulty: nat64;
    creator: Principal;
    created_at: nat64;
    updated_at: Opt<nat64>;
}>;

type VocubularyList = Record<{
    id: string;
    name: string;
    words: Vec<Word>;
    creator: Principal;
    created_at: nat64;
    updated_at: Opt<nat64>;
}>;

type WordPayload = Record<{
    word: string;
    meaning: string;
    difficulty: nat64;
}>


const wordStorage = new StableBTreeMap<string, Word>(0, 44, 512);
const listStorage = new StableBTreeMap<string, VocubularyList>(1, 44, 512);


//Create a Vocubulary List
$update
export function addVocubularyList(name: string): Result<VocubularyList, string>{
    try {
        const newVocubulary : VocubularyList = {
            id: uuidv4(),
            name,
            words:[],
            creator: ic.caller(),
            created_at: ic.time(),
            updated_at: Opt.None
        }
        listStorage.insert(newVocubulary.id, newVocubulary);
        return Result.Ok<VocubularyList, string>(newVocubulary)
    } catch (err) {
        return Result.Err<VocubularyList, string>('Issue encountered when Creating Vocubulary List');
    }
}

// update a Vocubulary list 
export function updateVocubularyList(id: string, name: string): Result<VocubularyList, string>{
    return match(listStorage.get(id),{
        Some: (list) => {
            // Authorization of user 
            if (list.creator.toString() !== ic.caller().toString()) {
                return Result.Err<VocubularyList, string>('You are not authorized to access Task');
            }
            const updatedList: VocubularyList = { ...list, name, updated_at: Opt.Some(ic.time()) };
            listStorage.insert(list.id, updatedList);
            return Result.Ok<VocubularyList, string>(updatedList);

        },
        None: () => Result.Err<VocubularyList, string>(`Vocubulary List with Id =${id} Not found`)
    })
}

// Initialize the number of words to list
const initWords = 5;

// get the first 5 words from the list
$query
export function getInitialWords(): Result<Vec<Word>, string> {
    const initialWords = wordStorage.values().slice(0, initWords);
    return Result.Ok(initialWords);
}

// get all words from the list
$query
export function getAllWords(): Result<Vec<Word>, string> {
    const allWords = wordStorage.values();
    return Result.Ok(allWords);
}

// get all lists
$query
export function getAllLists(): Result<Vec<VocubularyList>, string> {
    const allLists = listStorage.values();
    return Result.Ok(allLists);
}

// get a list by id
$query
export function getListById(id: string): Result<VocubularyList, string> {
   return match(listStorage.get(id),{
        Some: (list) => {
            if (list.creator.toString() !== ic.caller().toString()){
                return Result.Err<VocubularyList, string> ("Unauthorized access to Vocubulary list");
            }
            return Result.Ok<VocubularyList, string>(list);
        },
        None: () => Result.Err<VocubularyList, string>(`The List with id =${id} not available`)
   })
}

// delete a list by id
$update
export function deleteListById(id: string): Result<string, string> {
    return match(listStorage.get(id),{
        Some: (list) => {
            if (list.creator.toString() !== ic.caller().toString()){
                return Result.Err<string, string> ("Unauthorized access to Vocubulary list");
            }
            listStorage.remove(id);
            return Result.Ok<string, string>(`List with id = ${id} deleted successfully`);
        },
        None: () => Result.Err<string, string>(`The List with id =${id} not available`)
   })
}

// add a word to a list
$update
export function addWordToList(id: string, payload: WordPayload): Result<Word, string> {
    return match(listStorage.get(id),{
        Some: (list) => {
            if (list.creator.toString() !== ic.caller().toString()){
                return Result.Err<Word, string> ("Unauthorized access to Vocubulary list");
            }
            const newWord: Word = {
                id: uuidv4(),
                word: payload.word,
                meaning: payload.meaning,
                difficulty: payload.difficulty,
                creator: ic.caller(),
                created_at: ic.time(),
                updated_at: Opt.None
            }
            wordStorage.insert(newWord.id, newWord);
            list.words.push(newWord);
            listStorage.insert(list.id, list);
            return Result.Ok<Word, string>(newWord);
        },
        None: () => Result.Err<Word, string>(`The List with id =${id} not available`)
   })
}

// update a word in a list
$update
export function updateWordInList(listId: string, wordId: string, payload: WordPayload): Result<Word, string> {
    return match(listStorage.get(listId),{
        Some: (list) => {
            if (list.creator.toString() !== ic.caller().toString()){
                return Result.Err<Word, string> ("Unauthorized access to Vocubulary list");
            }
            const updatedWord: Word = {
                id: wordId,
                word: payload.word,
                meaning: payload.meaning,
                difficulty: payload.difficulty,
                creator: ic.caller(),
                created_at: ic.time(),
                updated_at: Opt.Some(ic.time())
            }
            wordStorage.insert(updatedWord.id, updatedWord);
            list.words = list.words.map((word) => {
                if (word.id === wordId) {
                    return updatedWord;
                }
                return word;
            });
            listStorage.insert(list.id, list);
            return Result.Ok<Word, string>(updatedWord);
        },
        None: () => Result.Err<Word, string>(`The List with id =${listId} not available`)
   })
}

// delete a word from a list
$update
export function deleteWordFromList(listId: string, wordId: string): Result<string, string> {
    return match(listStorage.get(listId),{
        Some: (list) => {
            if (list.creator.toString() !== ic.caller().toString()){
                return Result.Err<string, string> ("Unauthorized access to Vocubulary list");
            }
            list.words = list.words.filter((word) => word.id !== wordId);
            listStorage.insert(list.id, list);
            wordStorage.remove(wordId);
            return Result.Ok<string, string>(`Word with id = ${wordId} deleted successfully`);
        },
        None: () => Result.Err<string, string>(`The List with id =${listId} not available`)
   })
}

// get a word from a list
$query
export function getWordFromList(listId: string, wordId: string): Result<Word, string> {
    return match(listStorage.get(listId),{
        Some: (list) => {
            if (list.creator.toString() !== ic.caller().toString()){
                return Result.Err<Word, string> ("Unauthorized access to Vocubulary list");
            }
            const word = list.words.find((word) => word.id === wordId);
            if (word) {
                return Result.Ok<Word, string>(word);
            }
            return Result.Err<Word, string>(`Word with id = ${wordId} not found`);
        },
        None: () => Result.Err<Word, string>(`The List with id =${listId} not available`)
   })
}

// count number of words in a list
$query
export function countWordsInList(id: string): Result<number, string> {
    return match(listStorage.get(id),{
        Some: (list) => {
            if (list.creator.toString() !== ic.caller().toString()){
                return Result.Err<number, string> ("Unauthorized access to Vocubulary list");
            }
            return Result.Ok<number, string>(list.words.length);
        },
        None: () => Result.Err<number, string>(`The List with id =${id} not available`)
   })
}

// change my level of difficulty
$update
export function changeDifficultyOfWord(wordId: string, difficulty: nat64): Result<Word, string> {
    return match(wordStorage.get(wordId),{
        Some: (word) => {
            if (word.creator.toString() !== ic.caller().toString()){
                return Result.Err<Word, string> ("Unauthorized access to Vocubulary list");
            }
            const updatedWord: Word = {
                ...word,
                difficulty,
                updated_at: Opt.Some(ic.time())
            }
            wordStorage.insert(updatedWord.id, updatedWord);
            return Result.Ok<Word, string>(updatedWord);
        },
        None: () => Result.Err<Word, string>(`The Word with id =${wordId} not available`)
   })
}

// get words by difficulty
$query
export function getWordsByDifficulty(difficulty: nat64): Result<Vec<Word>, string> {
    const words = wordStorage.values().filter((word) => word.difficulty === difficulty);
    return Result.Ok(words);
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
