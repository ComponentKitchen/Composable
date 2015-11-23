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



describe("CompositionRules", () => {

  it("baseMethodFirst invokes base first, then mixin", () => {
    let subclass = composeSubclassUsingRule('method', CompositionRules.baseMethodFirst);
    let instance = new subclass();
    let result = instance.method();
    assert(instance.baseMethodInvoked);
    assert(instance.subclassMethodInvoked);
    assert(result, 'Subclass');
  });

  it("baseSetterFirst invokes base setter, then mixin setter", () => {
    let subclass = composeSubclassUsingRule('property', CompositionRules.baseSetterFirst);
    let instance = new subclass();
    instance.property = 'Hello';
    assert(instance.baseSetterInvoked);
    assert(instance.subclassSetterInvoked);
    let result = instance.property;
    assert(!instance.baseGetterInvoked);
    assert(instance.subclassGetterInvoked);
    assert(result, 'Hello');
  });

  it("preferBaseGetter invokes base getter first, returns that result if truthy", () => {
    let subclass = composeSubclassUsingRule('property', CompositionRules.preferBaseGetter);
    let instance = new subclass();
    let result = instance.property;
    assert(instance.baseGetterInvoked);
    assert(instance.subclassGetterInvoked);
    assert(result, 'Subclass');
    let instance2 = new subclass();
    instance2.property = 'Hello';
    let result2 = instance2.property;
    assert(instance2.baseGetterInvoked);
    assert(!instance2.subclassGetterInvoked);
    assert(result2, 'Hello');
  });

  it("preferMixinGetter invokes mixin getter first, returns that result if truthy", () => {
    let subclass = composeSubclassUsingRule('property', CompositionRules.preferMixinGetter);
    let instance = new subclass();
    let result = instance.property;
    assert(!instance.baseGetterInvoked);
    assert(instance.subclassGetterInvoked);
    assert(result, 'Hello');
  });

  it("preferBaseResult invokes base first, returns that result if truthy", () => {
    let subclass = composeSubclassUsingRule('method', CompositionRules.preferBaseResult);
    let instance = new subclass();
    let result = instance.method();
    assert(instance.baseMethodInvoked);
    assert(!instance.subclassMethodInvoked);
    assert(result, 'Base');
  });

  it("preferMixinResult invokes mixin first, returns that result if truthy", () => {
    let subclass = composeSubclassUsingRule('method', CompositionRules.preferMixinResult);
    let instance = new subclass();
    let result = instance.method();
    assert(!instance.baseMethodInvoked);
    assert(instance.subclassMethodInvoked);
    assert(result, 'Subclass');
  });

});


function createSubclass() {
  return class Subclass extends Base {

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
}

function composeSubclassUsingRule(key, rule) {
  let subclass = createSubclass();
  let descriptor = Object.getOwnPropertyDescriptor(subclass.prototype, key);
  rule(subclass.prototype, key, descriptor);
  Object.defineProperty(subclass.prototype, key, descriptor);
  return subclass;
}
