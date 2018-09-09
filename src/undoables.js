const REMOVE_OBJECT = 'REMOVE_OBJECT';
const ADD_OBJECT = 'ADD_OBJECT';
const EDIT_OBJECT = 'EDIT_OBJECT';
import { registerUndoable } from 're-extinguish';
import _ from 'lodash';
import Extinguish from 're-extinguish';

let UndoSpecs = [
  addObjectSpec(),
  removeObjectSpec(),
  editObjectSpec()
];
export default UndoSpecs;

export function removeObject(undo, firestore, collection, object, context) {
  return deleteObject(firestore, {collection, object});
  // return registerUndoable(undo, firestore, {
  //   type: REMOVE_OBJECT,
  //   collection,
  //   objectid: object.id
  // }, context);
}

export function removeObjectSpec() {
  return {
    name: REMOVE_OBJECT,
    do: deleteObject,
    doFinal: deleteObject,
    undo: () => {}
  }
}

export function addObject(undo, firestore, collection, object, context) {
  return add(firestore, {collection, object});
  // return registerUndoable(undo, firestore, {
  //   type: ADD_OBJECT,
  //   collection,
  //   object
  // }, context);
}

export function addObjectSpec() {
  return {
    name: ADD_OBJECT,
    do: add,
    undo: deleteObject
  }
}

export function editObject(undo, firestore, collection, object, changes, context) {
  return edit(firestore, {objectid: object.id, collection, original: object, changes});
  // return registerUndoable(undo, firestore, {
  //   type: EDIT_OBJECT,
  //   collection,
  //   objectid: object.id,
  //   original: object,
  //   changes
  // }, context);
}

export function editObjectSpec() {
  return {
    name: EDIT_OBJECT,
    do: edit,
    undo: unEdit
  };
}

function getCollection(collection, objectid) {
  if (typeof collection === 'string' || collection instanceof String) {
    return `${collection}/${objectid}`;
  } else {
    if (collection.subcollections != null) {
      collection.subcollections[collection.subcollections.length - 1].doc = objectid;
    } else {
      collection.doc = objectid;
    }
    return collection;
  }
}

function edit(firestore, {objectid, collection, original, changes}) {
  var newOriginal = {};
  var actualChanges = {};
  Object.keys(changes).forEach(function(key,index) {
    newOriginal[key] = original[key];
    if (changes[key] == null) {
      actualChanges[key] = firestore.FieldValue.delete();
    } else {
      actualChanges[key] = changes[key];
    }
  });
  return firestore.update(
    getCollection(collection, objectid), actualChanges
  ).then(() => {
    Object.assign(original, changes);
    return {
      collection,
      objectid,
      original: newOriginal,
      changes
    }
  });
}

function unEdit(firestore, {objectid, collection, original, changes}) {
  var actualChanges = {};
  Object.keys(changes).forEach(function(key,index) {
    if (original[key] == null) {
      actualChanges[key] = firestore.FieldValue.delete();
    } else {
      actualChanges[key] = original[key];
    }
  });
  return firestore.update(
    getCollection(collection, objectid), actualChanges
  ).then(() => {
    return null;
  });
}

function deactivate(firestore, {collection, objectid}) {
  return firestore.update(
    getCollection(collection, objectid),
    {
      active: false
    }
  ).then(() => {
    return null;
  });
}

function activate(firestore, {collection, objectid}) {
  return firestore.update(
    getCollection(collection, objectid),
    {
      active: true
    }
  ).then(() => {
    return null;
  });
}

function add(firestore, {collection, object}) {
  return firestore.add(
    collection,
    {...object, active: true}
  ).then((ret) => {
    return {collection, object: ret};
  });
}

function deleteObject(firestore, {collection, object}) {
  return firestore.delete(getCollection(collection, object.id));
}
