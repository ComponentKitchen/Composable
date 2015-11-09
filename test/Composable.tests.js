import Composable from "../src/Composable";


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

/* Mixin that overrides a base method */
class MethodMixinOverride {
  method() {
    this.mixinMethodInvoked = true;
    return 'MethodMixin';
  }
}
Composable.decorate.call(MethodMixinOverride.prototype, {
  method: Composable.rule(Composable.rules.override)
});


/* Mixin with method that invokes and uses base implementation if present */
class MethodMixinCallsSuper {
  method() {
    let base = this.MethodMixinCallsSuper.super.method;
    let result = base ? base.call(this) + ' ' : '';
    result += 'MethodMixinCallsSuper';
    this.mixinMethodInvoked = true;
    return result;
  }
}
Composable.decorate.call(MethodMixinCallsSuper.prototype, {
  method: Composable.rule(Composable.rules.override)
});


suite("Composable", () => {

  test("can extend class with ES6 class syntax", () => {
    class Subclass extends ExampleBase {
      get bar() {
        return true;
      }
    }
    let instance = new Subclass();
    assert.equal(instance.method(), 'ExampleBase');
    assert.equal(instance.bar, true);
  });

  test("can extend class with ES5-compatible .compose() syntax", () => {
    let Subclass = ExampleBase.compose({
      bar: true
    });
    let instance = new Subclass();
    assert.equal(instance.method(), 'ExampleBase');
    assert.equal(instance.bar, true);
  });

  test("class decorators applied to indicated members", () => {
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

  test("class mixin can define a property", () => {
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

  test("class mixin can define a method; base method is invoked too", () => {
    let Subclass = ExampleBase.compose(MethodMixin);
    let instance = new Subclass();
    let result = instance.method();
    assert.equal(result, 'MethodMixin');
    assert(instance.mixinMethodInvoked);
    assert(instance.baseMethodInvoked);
  });

  test("rule() decorator just records a decorator for later use", () => {
    class Subclass extends Composable {
      method() {}
    }
    function decorator(target, key, descriptor) {}
    Subclass.prototype.decorate({
      method: Composable.rule(decorator)
    });
    assert.equal(Subclass.prototype.method._compositionRule, decorator);
  });

  test("mixin method can use super() to invoke base class implementation", () => {
    let Subclass = ExampleBase.compose(MethodMixinCallsSuper);
    let instance = new Subclass();
    let result = instance.method();
    assert.equal(result, 'ExampleBase MethodMixinCallsSuper');
    assert(instance.mixinMethodInvoked);
    assert(instance.baseMethodInvoked);
  });

  test("multiple mixins can be applied in one call", () => {
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

  test("can extend a plain object", () => {
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

  test("mixin can has multiple levels of inheritance", () => {
    class MixinSubclass extends MethodMixin {
      method() {
        let superMethod = this.MixinSubclass.super.method;
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

  test("mixin property can reference superclass' property", () => {
    class PropertyMixin {
      get property() {
        let superPrototype = this.PropertyMixin.super;
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

});
