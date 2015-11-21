import { assert } from 'chai';

import Composable from '../src/Composable';


/* Sample classes used by the test suite */

/* A simple base class */
class ExampleBase extends Composable {

  get property() {
    this.baseGetterInvoked = true;
    return this._property;
  }
  set property(value) {
    this._property = value;
    this.baseSetterInvoked = true;
  }

  method() {
    this.baseMethodInvoked = true;
    return 'ExampleBase';
  }

}

/* Mixin that augments a property setter. */
class PropertyMixin {
  set property(value) {
    this.mixinSetterInvoked = true;
  }
}

/* Mixin that defines a method */
class MethodMixin {
  method() {
    this.mixinMethodInvoked = true;
    return 'MethodMixin';
  }
}


/* Mixin with method that invokes and uses base implementation if present */
class MethodMixinCallsSuper {
  method() {
    let base = this.prototypes.MethodMixinCallsSuper.super.method;
    let result = base ? base.call(this) + ' ' : '';
    result += 'MethodMixinCallsSuper';
    this.mixinMethodInvoked = true;
    return result;
  }
}
Composable.decorate.call(MethodMixinCallsSuper.prototype, {
  method: Composable.rule(Composable.rules.override)
});


describe("Composable", () => {

  it("can extend class with ES6 class syntax", () => {
    class Subclass extends ExampleBase {
      get bar() {
        return true;
      }
    }
    let instance = new Subclass();
    assert.equal(instance.method(), 'ExampleBase');
    assert.equal(instance.bar, true);
  });

  it("can extend class with ES5-compatible .compose() syntax", () => {
    let Subclass = ExampleBase.compose({
      bar: true
    });
    let instance = new Subclass();
    assert.equal(instance.method(), 'ExampleBase');
    assert.equal(instance.bar, true);
  });

  it("can apply class decorators to indicated members", () => {
    class Base extends Composable {
      method() {}
    }
    function decorator(target, key, descriptor) {
      descriptor.value.decorated = true;
    }
    Base.prototype.decorate({
      method: decorator
    });
    assert(Base.prototype.method.decorated);
  })

  it("lets a class mixin define a property", () => {
    // Make sure base class works as expected first.
    let baseInstance = new ExampleBase();
    assert(!baseInstance.baseGetterInvoked);
    let baseValue = baseInstance.property;
    assert.isUndefined(baseValue);
    assert(baseInstance.baseGetterInvoked);

    let Subclass = ExampleBase.compose(PropertyMixin);
    let instance = new Subclass();
    assert(!instance.baseGetterInvoked);
    assert(!instance.baseSetterInvoked);
    assert(!instance.mixinSetterInvoked);
    instance.property = 'value';
    assert(instance.baseSetterInvoked);
    assert(instance.mixinSetterInvoked);
    let result = instance.property;
    assert.equal(instance.property, 'value');
    assert(instance.baseGetterInvoked);
  });

  it("propagates method calls up the prototype chain by default", () => {
    let Subclass = ExampleBase.compose(MethodMixin);
    let instance = new Subclass();
    let result = instance.method();
    assert.equal(result, 'MethodMixin');
    assert(instance.mixinMethodInvoked);
    assert(instance.baseMethodInvoked);
  });

  it("provides a @rule decorator to record a method composition rule", () => {
    class Mixin {
      method() {
        return 'Mixin';
      }
    }
    function decorator(target, key, descriptor) {
      let mixinMethod = descriptor.value;
      let baseMethod = Object.getPrototypeOf(target)[key];
      descriptor.value = function() {
        return mixinMethod.call(this) + ' Decorator ' + baseMethod.call(this);
      }
    }
    Composable.decorate.call(Mixin.prototype, {
      method: Composable.rule(decorator)
    });
    let Subclass = ExampleBase.compose(Mixin);
    let instance = new Subclass();
    assert.equal(instance.method(), 'Mixin Decorator ExampleBase');
  });

  it("provides a @rule decorator to record a property composition rule", () => {
    class Mixin {
      get property() {
        return 'Mixin';
      }
    }
    function decorator(target, key, descriptor) {
      let mixinGetter = descriptor.get;
      let base = Object.getPrototypeOf(target);
      let baseDescriptor = Composable.rules.getPropertyDescriptor(base, key);
      let baseGetter = baseDescriptor.get;
      let baseSetter = baseDescriptor.set;
      descriptor.get = function() {
        return mixinGetter.call(this) + ' Decorator ' + baseGetter.call(this);
      };
      descriptor.set = function(value) {
        baseSetter.call(this, value);
      }
    }
    Composable.decorate.call(Mixin.prototype, {
      property: Composable.rule(decorator)
    });
    let Subclass = ExampleBase.compose(Mixin);
    let instance = new Subclass();
    instance.property = 'value';
    assert.equal(instance.property, 'Mixin Decorator value');
  });

  it("lets a mixin method use super() to invoke base class implementation", () => {
    let Subclass = ExampleBase.compose(MethodMixinCallsSuper);
    let instance = new Subclass();
    let result = instance.method();
    assert.equal(result, 'ExampleBase MethodMixinCallsSuper');
    assert(instance.mixinMethodInvoked);
    assert(instance.baseMethodInvoked);
  });

  it("composes multiple mixins in a single compose() call", () => {
    let Subclass = ExampleBase.compose(
      PropertyMixin,
      MethodMixin
    );
    let instance = new Subclass();
    instance.property = 'value';
    assert(instance.mixinSetterInvoked);
    assert(instance.baseSetterInvoked);
    assert.equal(instance.property, 'value');
    assert(instance.baseGetterInvoked);
    let result = instance.method();
    assert.equal(result, 'MethodMixin');
    assert(instance.mixinMethodInvoked);
  });

  it("can extend a plain object", () => {
    let obj = {
      method() {
        return 'result';
      }
    };
    let mixin = {
      property: 'value'
    };
    let composed = Composable.compose.call(obj, mixin);
    assert.equal(composed.method(), 'result');
    assert.equal(composed.property, 'value');
  });

  it("supports mixins with multiple levels of inheritance", () => {
    class MixinSubclass extends MethodMixin {
      method() {
        let superMethod = this.prototypes.MixinSubclass.super.method;
        if (superMethod) {
          superMethod.call(this);
        }
        this.mixinSubclassMethodInvoked = true;
      }
    }
    let Subclass = Composable.compose(MixinSubclass);
    let instance = new Subclass();
    instance.method();
    assert(instance.mixinMethodInvoked);
    assert(instance.mixinSubclassMethodInvoked);
  });

  it("lets a mixin property reference superclass' property", () => {
    class PropertyMixin {
      get property() {
        let superPrototype = this.prototypes.PropertyMixin.super;
        let descriptor = superPrototype && Object.getOwnPropertyDescriptor(superPrototype, 'property');
        return (descriptor) ?
          descriptor.get.call(this) :
          'PropertyMixin';
      }
    }
    class Subclass extends Composable {
      get property() {
        return 'Subclass';
      }
    }
    Subclass = Subclass.compose(PropertyMixin);
    let instance = new Subclass();
    assert.equal(instance.property, 'Subclass');
  });

  it("lets a subclass define inheritable composition rules", () => {
    class Base extends Composable {};
    Base.prototype.compositionRules = {
      // From this point on prototype chain on down, methods named "method"
      // should override.
      method: Composable.rules.override
    };
    let Subclass = Base.compose(MethodMixin);
    let instance = new Subclass();
    instance.method();
    assert(!instance.baseMethodInvoked); // Overridden, so never invoked.
    assert(instance.mixinMethodInvoked);
  });

  it("skips adding a prototype that is already in the chain", () => {
    let Subclass = Composable.compose(Composable);
    // New class shouldn't get its own copy of the compose() method.
    let propertyNames = Object.getOwnPropertyNames(Subclass.prototype);
    assert(propertyNames.indexOf('compose') < 0);
  });

  it("skips adding a mixin already composed into the chain", () => {
    let Class1 = Composable.compose(MethodMixin);
    assert(Object.getOwnPropertyNames(Class1.prototype).indexOf('method') >= 0);
    let Class2 = Class1.compose(MethodMixin); // Shouldn't add 2nd copy of mixin
    assert(Object.getOwnPropertyNames(Class2.prototype).indexOf('method') < 0);
  });

});
