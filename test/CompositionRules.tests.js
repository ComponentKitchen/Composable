import { assert } from 'chai';

import * as CompositionRules from '../src/CompositionRules';


class Base {

  get property() {
    this.baseGetterInvoked = true;
    return this._property;
  }
  set property(value) {
    this.baseSetterInvoked = true;
    this._property = value;
  }

  method() {
    this.baseMethodInvoked = true;
    return 'Base';
  }

}
Base.prototype.value = {
  a: 'Base',
  b: 'Base'
};


describe("CompositionRules", () => {

  it("baseMethodFirst invokes base first, then mixin", () => {
    let Subclass = composeSubclassUsingRule('method', CompositionRules.baseMethodFirst);
    let instance = new Subclass();
    let result = instance.method();
    assert(instance.baseMethodInvoked);
    assert(instance.subclassMethodInvoked);
    assert(result, 'Subclass');
  });

  it("baseSetterFirst invokes base setter, then mixin setter", () => {
    let Subclass = composeSubclassUsingRule('property', CompositionRules.baseSetterFirst);
    let instance = new Subclass();
    instance.property = 'Hello';
    assert(instance.baseSetterInvoked);
    assert(instance.subclassSetterInvoked);
    let result = instance.property;
    assert(!instance.baseGetterInvoked);
    assert(instance.subclassGetterInvoked);
    assert(result, 'Hello');
  });

  it("override invokes mixin but not base", () => {
    let Subclass = composeSubclassUsingRule('method', CompositionRules.override);
    let instance = new Subclass();
    let result = instance.method();
    assert(!instance.baseMethodInvoked);
    assert(instance.subclassMethodInvoked);
    assert.equal(result, 'Subclass');
  });

  it("preferBaseGetter invokes base getter first, returns that result if truthy", () => {
    let Subclass = composeSubclassUsingRule('property', CompositionRules.preferBaseGetter);
    let instance = new Subclass();
    let result = instance.property;
    assert(instance.baseGetterInvoked);
    assert(instance.subclassGetterInvoked);
    assert(result, 'Subclass');
    let instance2 = new Subclass();
    instance2.property = 'Hello';
    let result2 = instance2.property;
    assert(instance2.baseGetterInvoked);
    assert(!instance2.subclassGetterInvoked);
    assert(result2, 'Hello');
  });

  it("preferMixinGetter invokes mixin getter first, returns that result if truthy", () => {
    let Subclass = composeSubclassUsingRule('property', CompositionRules.preferMixinGetter);
    let instance = new Subclass();
    let result = instance.property;
    assert(!instance.baseGetterInvoked);
    assert(instance.subclassGetterInvoked);
    assert(result, 'Hello');
  });

  it("preferBaseResult invokes base first, returns that result if truthy", () => {
    let Subclass = composeSubclassUsingRule('method', CompositionRules.preferBaseResult);
    let instance = new Subclass();
    let result = instance.method();
    assert(instance.baseMethodInvoked);
    assert(!instance.subclassMethodInvoked);
    assert(result, 'Base');
  });

  it("preferMixinResult invokes mixin first, returns that result if truthy", () => {
    let Subclass = composeSubclassUsingRule('method', CompositionRules.preferMixinResult);
    let instance = new Subclass();
    let result = instance.method();
    assert(!instance.baseMethodInvoked);
    assert(instance.subclassMethodInvoked);
    assert(result, 'Subclass');
  });

  it("shallowMerge performs a shallow merge of mixin over base value", () => {
    let Subclass = composeSubclassUsingRule('value', CompositionRules.shallowMerge);
    let instance = new Subclass();
    assert.deepEqual(instance.value, {
      a: 'Subclass',
      b: 'Base',
      c: 'Subclass'
    });
  });

});


function createSubclass() {
  class Subclass extends Base {

    get property() {
      this.subclassGetterInvoked = true;
      return 'Subclass';
    }
    set property(value) {
      this.subclassSetterInvoked = true;
    }

    method() {
      this.subclassMethodInvoked = true;
      return 'Subclass';
    }

  }
  Subclass.prototype.value = {
    a: 'Subclass',
    c: 'Subclass'
  };
  return Subclass;
}

function composeSubclassUsingRule(key, rule) {
  let subclass = createSubclass();
  let descriptor = Object.getOwnPropertyDescriptor(subclass.prototype, key);
  rule(subclass.prototype, key, descriptor);
  Object.defineProperty(subclass.prototype, key, descriptor);
  return subclass;
}
