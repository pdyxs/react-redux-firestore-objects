import _ from 'lodash';

export default class FirestoreObject {
  constructor(data) {
    this.data = data;
    _.forEach(data, (value, key) => {
      this.setGetterTo(key);
    });
  }

  setGetterTo(key) {
    if (!this[key]) {
      Object.defineProperty(this, key, {
        get: function() {
          return this.data[key];
        }
      });
    }
  }

  setPropertyTo(key, value) {
    Object.defineProperty(this, key, { value: value, writable: false, configurable: true });
    return value;
  }
}
