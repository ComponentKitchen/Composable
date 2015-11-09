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
   * This method can be statically invoked to extend plain objects:
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

  static decorate(decorators) {
    for (let key in decorators) {
      let decorator = decorators[key];
      let descriptor = Object.getOwnPropertyDescriptor(this, key);
      decorator(this, key, descriptor);
      Object.defineProperty(this, key, descriptor);
    }
  }

  decorate(decorators) {
    Composable.decorate.call(this, decorators);
  }

  // Decorate for annotating how a class member should be composed later.
  // This takes a decorator that will be run at *composition* time.
  // For now, this can only be applied to methods.
  static rule(decorator) {
    // We return a decorator that just adds the decorator given above to the
    // member.
    return function(target, key, descriptor) {
      // TODO: Use a Symbol instead of a string property name to save this.
      descriptor.value._compositionRule = decorator;
    }
  }

}


/*
 * Expose standard composition rules as properties of Composable.
 * This avoids the need for someone to make a separate import of the rules.
 */
Composable.rules = CompositionRules;


/*
 * All Composable-created objects keep references to the mixins that were
 * applied to create them. When a *named* mixin is applied to the prototype
 * chain, the resulting object (or, for a class, the class' prototype) will
 * have a new member with that name that points back to the same object.
 * That facility is useful when dealing with chains that have been extended
 * more than once, as an mixin's name is sufficient to retrieve a reference
 * to that point in the prototype chain.
 *
 * A single mixin can be applied to multiple prototype chains -- the name
 * refers to the prototype on *this particular prototype chain* that was added
 * for that mixin. This lets mixin/mixin code get back to its own
 * prototype, most often in combination with "super" (see below) in order to
 * invoke superclass behavior.
 */
Composable.prototype.Composable = Composable.prototype;

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
 *       if (this.Mixin.super.foo) {
 *         this.Mixin.super.foo.call(this); // Invoke superclass' foo()
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
  constructor: Composable.override,
  toString: Composable.override,
};


function applyCompositionRules(obj) {
  let base = Object.getPrototypeOf(obj);
  Object.getOwnPropertyNames(obj).forEach(name => {
    if (name in base) {
      // Base also implements a member with the same name; need to combine.
      let descriptor = Object.getOwnPropertyDescriptor(obj, name);
      let rule = descriptor.value && descriptor.value._compositionRule;
      if (!rule) {
        // See if prototype chain has a rule for this member.
        rule = obj.compositionRules[name];
      }
      if (!rule) {
        rule = getDefaultCompositionRule(descriptor);
      }
      // "override" is a known no-op, so we don't bother trying to redefine the
      // property.
      if (rule && rule !== Composable.override) {
        rule(obj, name, descriptor);
        Object.defineProperty(obj, name, descriptor);
      }
    }
  });
}


/*
 * Copy the given properties/methods to the target.
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

  // Check whether the base and mixin are classes or plain objects.
  let baseIsClass = isClass(base);
  let mixinIsClass = isClass(mixin);

  // Check to see if the *mixin* has a base class/prototype of its own.
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
  let result;
  if (baseIsClass) {
    // Create a subclass of base. Once WebKit supports HTMLElement as a real
    // class, we can just say:
    //
    //   class subclass extends base {}
    //
    // However, until that's resolved, we have to construct the class ourselves.
    result = function subclass() {};
    Object.setPrototypeOf(result, base);
    Object.setPrototypeOf(result.prototype, base.prototype);
  } else {
    // Create a plain object that simply uses the base as a prototype.
    result = Object.create(base);
  }

  let source;
  let target;
  if (baseIsClass && mixinIsClass) {
    // Properties defined by Function.
    // We'd prefer to get by interrogating Function itself, but WebKit functions
    // have some properties (arguments and caller) which are not returned by
    // Object.getOwnPropertyNames(Function).
    const FUNCTION_PROPERTIES = [
      'arguments',
      'caller',
      'length',
      'name',
      'prototype'
    ];
    // Extending a class with a class.
    // We'll copy instance members in a moment, but first copy static members.
    copyOwnProperties(mixin, result, FUNCTION_PROPERTIES);
    source = mixin.prototype;
    target = result.prototype;
  } else if (!baseIsClass && mixinIsClass) {
    // Extending a plain object with a class.
    // Copy prototype methods directly to result.
    source = mixin.prototype;
    target = result;
  } else if (baseIsClass && !mixinIsClass) {
    // Extending class with plain object.
    // Copy mixin to result prototype.
    source = mixin;
    target = result.prototype;
  } else {
    // Extending a plain object with a plain object.
    source = mixin;
    target = result;
  }
  copyOwnProperties(source, target, ['constructor']);

  applyCompositionRules(target);

  if (mixin.name) {
    // Use the mixin's name (usually the name of a class' constructor) to
    // save a reference back to the newly-created object in the prototype chain.
    target[mixin.name] = target;

    // Save a reference to the superclass/super-object. See the comments on
    // Composable's "super" property.
    target.super = baseIsClass ? base.prototype : base;
  }

  return result;
}

function getDefaultCompositionRule(descriptor) {
  if (typeof descriptor.value === 'function') {
    return Composable.rules.propagateFunction;
  } else if (typeof descriptor.get === 'function' || typeof descriptor.set === 'function') {
    // Property with getter and/or setter.
    return Composable.rules.propagateProperty;
  }
  return null;
}

// Return true if c is a JavaScript class.
// We use this test because, on WebKit, classes like HTMLElement are special,
// and are not instances of Function. To handle that case, we use a looser
// definition: an object is a class if it has a prototype, and that prototype
// has a constructor that is the original object. This condition holds true even
// for HTMLElement on WebKit.
function isClass(c) {
  return typeof c === 'function' ||                   // Standard
      (c.prototype && c.prototype.constructor === c); // HTMLElement in WebKit
}
