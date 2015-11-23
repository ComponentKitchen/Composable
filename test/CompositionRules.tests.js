import { assert } from 'chai';

import * as CompositionRules from '../src/CompositionRules';


class Base {
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
  class Subclass extends Base {
    method() {
      this.subclassMethodInvoked = true;
      return 'Subclass';
    }
  }
  return Subclass;
}

function composeSubclassUsingRule(key, rule) {
  let subclass = createSubclass();
  let descriptor = Object.getOwnPropertyDescriptor(subclass.prototype, key);
  rule(subclass.prototype, key, descriptor);
  Object.defineProperty(subclass.prototype, key, descriptor);
  return subclass;
}
