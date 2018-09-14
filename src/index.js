import UndoSpecs, { removeObject, addObject, editObject } from './undoables';
import { connectObjects, connectObject, getObjectHandlers } from './connect';
import FirestoreObject from './FirestoreObject';

export {
  UndoSpecs,
  addObject,
  removeObject,
  editObject,
  connectObjects,
  connectObject,
  getObjectHandlers,
  FirestoreObject
}
