/*
 * Extend classes/objects with other classes/objects.
 */

import * as CompositionRules from './CompositionRules';

export default class Composable {

  /*
   * Return a subclass of the current class that includes the members indicated
   * in the argument. The argument can be a plain JavaScript object, or a class
   * whose prototype contains the members that will be copied.
   *
   * This can be used for a couple of purposes:
   * 1. Extend a class with mixins/behaviors.
   * 2. Create a component class in ES5.
   *
   * The call
   *
   *   MyBaseClass.compose(Mixin1, Mixin2, Mixin3)
   *
   * will return a new class of MyBaseClass that implements all the methods in
   * the three mixins given. The above is equivalent to
   *
   *   MyBaseClass.compose(Mixin1).compose(Mixin2).compose(Mixin3)
   *
   * This method can be statically invoked to extend plain objects or classes
   * that don't inherit from this class:
   *
   *   let extended = Composable.extend.call(obj1, obj2);
   *
   */
  static compose(...mixins) {
    // We create a new subclass for each mixin in turn. The result becomes
    // the base class extended by any subsequent mixins. It turns out that
    // we can use Array.reduce() to concisely express this, using the current
    // (original) class as the seed for reduce().
    return mixins.reduce(compose, this);
  }

  /*
   * Decorate "this" with the indicated decorators. The latter should be a
   * dictionary mapping property names to (proposed) ES7-compliant decorators.
   * This allows the use of decorators in ES6/5. Example, this ES7 code:
   *
   *   class Foo {
   *      @decorate(customDecorator)
   *      bar() {}
   *   }
   *
   * can be written using the decorate() method as:
   *
   *   class Foo {
   *      bar() {}
   *   }
   *   Composable.decorate.call(Foo.prototype, { bar: customDecorator });
   *
   * Or, if Foo derives from Composable already, this can be shorter:
   *
   *   class Foo extends Composable {
   *      bar() {}
   *   }
   *   Foo.prototype.decorate({ bar: customDecorator });
   *
   */
  static decorate(decorators) {
    for (let key in decorators) {
      let decorator = decorators[key];
      let descriptor = Object.getOwnPropertyDescriptor(this, key);
      decorator(this, key, descriptor);
      Object.defineProperty(this, key, descriptor);
    }
  }

  /*
   * Decorates the prototype of a class derived from Composable.
   * See notes for the static decorate() method.
   */
  decorate(decorators) {
    Composable.decorate.call(this, decorators);
  }

  /*
   * Decorator for annotating how a class member should be composed later.
   * This takes a decorator that will be run at *composition* time.
   * For now, this can only be applied to methods.
   */
  static rule(decorator) {
    // Return a decorator that records the given decorator on the member itself.
    return function(target, key, descriptor) {
      // TODO: Use a Symbol instead of a string property name to save this.
      // descriptor.value._compositionRule = decorator;
      if (!target._compositionRules) {
        target._compositionRules = {};
      }
      target._compositionRules[key] = decorator;
    }
  }

}


/*
 * Expose standard composition rules as properties of Composable.
 * This avoids the need for someone to make a separate import of the rules.
 */
Composable.rules = CompositionRules;


/*
 * All Composable objects have a "prototypes" key that keeps references to the
 * mixins that were applied along the prototype chain. When a *named* mixin is
 * applied to the prototype chain, the resulting object (or, for a class, the
 * class' prototype) will have a "prototypes" value for that name that points
 * back to the mixin. That is, a mixin can get a pointer to itself in the chain.
 *
 * A single mixin can be applied to multiple prototype chains -- the name
 * refers to the prototype on *this particular prototype chain* that was added
 * for that mixin. This lets mixin/mixin code get back to its own
 * prototype, most often in combination with "super" (see below) in order to
 * invoke superclass behavior.
 */
Composable.prototype.prototypes = {
  Composable: Composable.prototype
};

/*
 * All Composable-created objects have a "super" property that references the
 * prototype above them in the prototype chain.
 *
 * This "super" reference is used as a replacement for ES6's "super" keyword in
 * in ES5 (or transpiled ES6) mixins that want to invoke superclass behavior,
 * where the specific superclass will depend upon which mixins have been applied
 * to a given prototype chain.
 *
 * E.g.:
 *   class Mixin {
 *     foo() {
 *       if (this.protoypes.Mixin.super.foo) {
 *         this.prototypes.Mixin.super.foo.call(this); // Invoke superclass' foo()
 *       }
 *       // Do Mixin-specific work here...
 *     }
 *   }
 *
 * For consistency, Composable itself records its own superclass as Object.
 */
Composable.prototype.super = Object.prototype;


// Composition rules for standard object members.
Composable.prototype.compositionRules = {
  '__method__': Composable.rules.baseMethodFirst,
  '__property__': Composable.rules.baseSetterFirst,
  'compositionRules': Composable.rules.chainPrototypes,
  'prototypes': Composable.rules.chainPrototypes
};


// Properties defined by Function that we don't want to mixin.
// We'd prefer to get these by interrogating Function itself, but WebKit
// functions have some properties (arguments and caller) which are not returned
// by Object.getOwnPropertyNames(Function).
const NON_MIXABLE_FUNCTION_PROPERTIES = [
  'arguments',
  'caller',
  'length',
  'name',
  'prototype'
];

// Properties defined by Object that we don't want to mixin.
const NON_MIXABLE_OBJECT_PROPERTIES = [
  'constructor'
];


/*
 * Apply the composition rules in effect for the given object, which lies at
 * the tip of a prototype chain. This looks for conflicts between the object's
 * own properties (and methods), and identically-named properties (methods)
 * further up the prototype chain. Conflicts are resolved with rules defined by
 * the affect members.
 */
function applyCompositionRules(obj) {
  let ownCompositionRules = obj.hasOwnProperty('_compositionRules') ?
    obj._compositionRules :
    {};
  let inheritedCompositionRules = obj.compositionRules;
  let defaultCompositionRules = Composable.prototype.compositionRules;

  // For each property name, see if the base has a property with the same name.
  let base = Object.getPrototypeOf(obj);
  Object.getOwnPropertyNames(obj).forEach(name => {
    if (name in base && NON_MIXABLE_OBJECT_PROPERTIES.indexOf(name) < 0) {
      // Base does implement a member with the same name; need to combine.
      let descriptor = Object.getOwnPropertyDescriptor(obj, name);
      let key = getGeneralDescriptorKey(descriptor);

      // See if this property has a rule associated with it, checking:
      let rule = ownCompositionRules[name]    // object itself
          || inheritedCompositionRules[name]  // inherited rules for name
          || inheritedCompositionRules[key]   // inherited rules generally
          || defaultCompositionRules[name]    // default rules for name
          || defaultCompositionRules[key];    // default rules generally

      // "override" is a known no-op, so we don't bother trying to redefine the
      // property.
      if (rule && rule !== Composable.rules.override) {
        rule(obj, name, descriptor);
        Object.defineProperty(obj, name, descriptor);
      }
    }
  });
}


/*
 * Copy the given properties/methods to the target.
 * Return the updated target.
 */
function copyOwnProperties(source, target, ignorePropertyNames = []) {
  Object.getOwnPropertyNames(source).forEach(name => {
    if (ignorePropertyNames.indexOf(name) < 0) {
      let descriptor = Object.getOwnPropertyDescriptor(source, name);
      Object.defineProperty(target, name, descriptor);
    }
  });
  return target;
}


/*
 * Return a new subclass/object that extends the given base class/object with
 * the members of the indicated mixin.
 */
function compose(base, mixin) {

  // See if the *mixin* has a base class/prototype of its own.
  let mixinIsClass = isClass(mixin);
  let mixinBase = mixinIsClass ?
    Object.getPrototypeOf(mixin.prototype).constructor :
    Object.getPrototypeOf(mixin);
  if (mixinBase &&
      mixinBase !== Function &&
      mixinBase !== Object &&
      mixinBase !== Object.prototype) {
    // The mixin itself derives from another class/object.
    // Recurse, and extend with the mixin's base first.
    base = compose(base, mixinBase);
  }

  // Create the extended object we're going to return as a result.
  let baseIsClass = isClass(base);
  let result = baseIsClass ?
    createSubclass(base) :
    Object.create(base);

  // Check to make sure we're not extending the base with a prototype that was
  // already composed into the object's prototype chain.
  let basePrototype = baseIsClass ? base.prototype : base;
  let mixinPrototype = mixinIsClass ? mixin.prototype : mixin;
  if (objectComposedWithPrototype(basePrototype, mixinPrototype)) {
    // Skip this mixin, return result as is.
    return result;
  }

  // The "target" here is the target of our property/method composition rules.
  let target;
  if (baseIsClass && mixinIsClass) {
    // Extending class with class: copy static members, then prototype members.
    copyOwnProperties(mixin, result, NON_MIXABLE_FUNCTION_PROPERTIES);
    target = copyOwnProperties(mixin.prototype, result.prototype, NON_MIXABLE_OBJECT_PROPERTIES);
  } else if (!baseIsClass && mixinIsClass) {
    // Extending plain object with class: copy prototype methods to result.
    target = copyOwnProperties(mixin.prototype, result, NON_MIXABLE_FUNCTION_PROPERTIES);
  } else if (baseIsClass && !mixinIsClass) {
    // Extending class with plain object: copy mixin to result prototype.
    target = copyOwnProperties(mixin, result.prototype, NON_MIXABLE_OBJECT_PROPERTIES);
  } else {
    // Extending plain object with plain object: copy former to latter.
    target = copyOwnProperties(mixin, result, NON_MIXABLE_OBJECT_PROPERTIES);
  }

  if (mixin.name) {
    // Use the mixin's name (usually the name of a class' constructor) to
    // save a reference back to the tip of the newly-extended prototype chain.
    // See notes at Composable's "prototypes" property.
    target.prototypes = {};
    target.prototypes[mixin.name] = target;

    // Save a reference to the superclass/super-object. See the comments on
    // Composable's "super" property.
    target.super = baseIsClass ? base.prototype : base;
  }

  // Apply the composition rules in effect at the target.
  applyCompositionRules(target);

  return result;
}


/*
 * Return a new subclass of the given base class.
 */
function createSubclass(base) {
  // Once WebKit supports HTMLElement as a real class, we can just say:
  //
  //   class subclass extends base {}
  //
  // However, until that's resolved, we just construct the class ourselves.
  function subclass() {};
  Object.setPrototypeOf(subclass, base);
  Object.setPrototypeOf(subclass.prototype, base.prototype);
  return subclass;
}


/*
 * Examine the descriptor to determine which rule key applies.
 */
function getGeneralDescriptorKey(descriptor) {
  if (typeof descriptor.value === 'function') {
    // Method
    return '__method__';
  } else if (typeof descriptor.get === 'function'
      || typeof descriptor.set === 'function') {
    // Property with getter and/or setter
    return '__property__';
  }
  return null;
}


/*
 * Return true if c is a JavaScript class.
 *
 * We use this test because, on WebKit, classes like HTMLElement are special,
 * and are not instances of Function. To handle that case, we use a looser
 * definition: an object is a class if it has a prototype, and that prototype
 * has a constructor that is the original object. This condition holds true even
 * for HTMLElement on WebKit.
 */
function isClass(c) {
  return typeof c === 'function' ||                   // Standard
      (c.prototype && c.prototype.constructor === c); // HTMLElement in WebKit
}


/*
 * Return true if the given object either has the given prototype on its
 * chain, or had *copy of* the prototype composed into its chain.
 */
function objectComposedWithPrototype(obj, prototype) {
  if (prototype.constructor === Object) {
    // The prototype is a plain object.
    // Only case to defend against is someone trying to mixin Object itself.
    return (prototype === Object.prototype);
  }
  if (obj === prototype || obj instanceof prototype.constructor) {
    // The prototype was found along the prototype chain.
    return true;
  }
}
