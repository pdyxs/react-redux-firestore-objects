import { compose } from "redux";
import { connect } from "react-redux";
import { getContext, withContext, withHandlers, withProps } from 'recompose';
import PropTypes from 'prop-types';
import { addObject, removeObject, editObject } from './undoables';
import { connectUndo, buildUndoableContext } from 're-extinguish';
import { withName } from 'reramble';
import {
  checkIfPropsOrContextContains,
  checkIfInPropsContextOrOrdered,
  connectRouter
} from '@pdyxs/re-connect';
import {
  connectStore,
  connectFirestore
} from '@pdyxs/re-connect-firebase';

import _ from 'lodash';

const OBJECT = 'Object';
const OBJECTS = 'Objects';
const BY_ID = '_id';

function getRequiredConnections(spec, options) {
  let requiredComposables = [];
  if (spec.requires) {
    spec.requires.forEach((r) => requiredComposables.push(r(options)));
  }
  return requiredComposables;
}

function connectObjectsToClass(spec, options) {
  if (!spec.class) {
    return compose();
  }

  var name = spec.name + OBJECTS;
  var connect = withProps((props) => {
    var ret = {};
    ret[name] = _.map(props[spec.listName], o => new spec.class(o, props));
    return ret;
  });
  if (!options.overrideCheck)
  {
    return checkIfPropsOrContextContains({
        name: name,
        type: PropTypes.array
      },
      connect
    );
  }
  return connect;
}

function connectObjectsById(spec, options) {
  var name = spec.listName + BY_ID;
  var objectName = spec.class ? spec.name + OBJECTS : spec.listName;
  var connect = withProps((props) => {
    var ret = {};
    ret[name] = _.fromPairs(_.map(props[objectName], o => [o.id, o]));
    return ret;
  });
  if (!options.overrideCheck)
  {
    return checkIfPropsOrContextContains({
        name: name,
        type: PropTypes.object
      },
      connect
    );
  }
  return connect;
}

export function connectObjects(spec, options = {}) {
  let storedName = (spec.getStoredName || (() => spec.listName));

  if (options[spec.listName + 'Store']) {
    if (_.isFunction(options[spec.listName + 'Store'])) {
      storedName = options[spec.listName + 'Store'];
    } else {
      storedName = () => options[spec.listName + 'Store'];
    }
  }

  var connector = compose(
    connectFirestore((props) => ([{
      ...spec.getCollection(props),
      orderBy: spec.orderBy,
      storeAs: storedName(props)
    }]))
  );

  var mapStateToProps = ({firestore: {ordered}}, props) => {
    let ret = {};
    var sname = storedName(props);
    ret[spec.listName] = ordered[sname];
    return ret;
  };

  if (!options.overrideCheck)
  {
    return compose(
      ...getRequiredConnections(spec, options),
      checkIfInPropsContextOrOrdered(
        {
          name: spec.listName,
          getStoredName: spec.getStoredName,
          type: PropTypes.array
        },
        connector,
        mapStateToProps
      ),
      connectObjectsToClass(spec, options),
      connectObjectsById(spec, options)
    );
  }

  return compose(
    connector,
    connect(mapStateToProps),
    connectObjectsToClass(spec, options),
    connectObjectsById(spec, options)
  );
}

export function connectObject(spec, options = {}) {
  let getters = [
    connectObjects(spec, options)
  ];
  if (!options.idPropName) {
    getters.push(connectRouter());
  }
  getters = getters.concat(
    withName(`${spec.name} from ${spec.listName}`),
    withProps((props) => {
      let ret = {};
      let targetid = props[spec.name + 'id'];
      if (options[spec.name + 'id']) {
        targetid = options[spec.name + 'id'];
        if (_.isFunction(targetid)) {
          targetid = targetid(props);
        }
      }
      if (targetid == null) {
        targetid = props.match.params[spec.name + 'id'];
      }

      if (props[spec.listName]) {
        if (spec.class) {
          ret[spec.name + OBJECT] = props[spec.listName + BY_ID][targetid];
          ret[spec.name] = ret[spec.name + OBJECT] ? ret[spec.name + OBJECT].data : null;
        } else {
          ret[spec.name] = props[spec.listName + BY_ID][targetid];
        }
      }
      return ret;
    })
  );

  if (options.overrideCheck) {
    return compose(...getters);
  }
  return checkIfPropsOrContextContains(
    {
      name: spec.name,
      type: PropTypes.object,
      dontSave: options.dontSave || options.idPropName
    },
    compose(
      ...getters
    )
  );
}

export const ON_ADD = 'onAdd';
export const ON_REMOVE = 'onRemove';
export const ON_EDIT = 'onEdit';

export function getObjectHandlers(spec, options = {}) {
  let handlers = options.handlers || [ON_ADD, ON_REMOVE, ON_EDIT];
  let allHandlers = {};
  let handlerSuffix = (options.useSpecName ? _.upperFirst(spec.name) : '');
  handlers.forEach((h) => {
    switch (h) {
      case ON_ADD:
        allHandlers[ON_ADD + handlerSuffix] = spec.onAdd ||
          (props => object =>
            addObject(props.undo || props.auth.uid, props.store.firestore,
            spec.getCollection(props), object, buildUndoableContext(props)))
        break;
      case ON_REMOVE:
        allHandlers[ON_REMOVE + handlerSuffix] = spec.onRemove ||
          (props => object =>
            removeObject(props.undo || props.auth.uid, props.store.firestore,
            spec.getCollection(props), object, buildUndoableContext(props)))
        break;
      case ON_EDIT:
        allHandlers[ON_EDIT + handlerSuffix] = spec.onEdit ||
          (props => (object, changes) =>
            editObject(props.undo || props.auth.uid,
            props.store.firestore, spec.getCollection(props),
            object, changes, buildUndoableContext(props)))
        break;
    }
  });

  return compose(
    ...getRequiredConnections(spec, options),
    connectRouter(),
    withName(`${spec.name} handlers`),
    connectStore(),
    // connectUndo(),
    withHandlers(allHandlers)
  );
}
