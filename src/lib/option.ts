import { Result } from './result';

interface OptionImpl<A> {
  _tag: 'Some' | 'None';
  value: A;
  map<B>(f: (a: A) => B): Option<B>;
  flatMap<B>(f: (a: A) => Option<B>): Option<B>;
  unwrap(): A;
  unwrapOr(a: A): A;
  isSome(): this is Some<A>;
  isNone(): this is None<A>;
  fold<B>(onNone: () => B, onSome: (a: A) => B): B;
}

export class OptionStatic {
  static of<A>(a: A): Option<NonNullable<A>> {
    return Option.fromNullable(a);
  }

  static Some<A>(a: A): Option<A> {
    return new Some(a);
  }

  static None<A>(): Option<A> {
    return new None();
  }

  static fromNullable<A>(a: A | null | undefined): Option<NonNullable<A>> {
    return a == null ? Option.None() : Option.Some(a);
  }

  static fromFalsy<A>(a: A | null | undefined | false): Option<A> {
    return a ? Option.Some(a) : Option.None();
  }

  static fromPredicate<A>(a: A, p: (a: A) => boolean): Option<A> {
    return p(a) ? Option.Some(a) : Option.None();
  }

  static fromResult<E, A>(r: Result<E, A>): Option<A> {
    return Result.isOk(r) ? Option.Some(r.value) : Option.None();
  }

  static toResult<E, A>(e: (() => E) | E, o: Option<A>): Result<E, A> {
    return o.isSome()
      ? Result.Ok(o.value)
      : Result.Err(e instanceof Function ? e() : e);
  }
}

export type Option<A> = Some<A> | None<A>;
export const Option = OptionStatic;

class Some<A> implements OptionImpl<A> {
  _tag: 'Some' = 'Some';
  value: A;
  constructor(value: A) {
    this.value = value;
  }
  map<B>(f: (a: A) => B): Option<B> {
    return OptionStatic.Some(f(this.value));
  }
  flatMap<B>(f: (a: A) => Option<B>): Option<B> {
    return f(this.value);
  }
  unwrap(): A {
    return this.value;
  }
  unwrapOr(a: A): A {
    return this.value;
  }
  isSome(): this is Some<A> {
    return true;
  }
  isNone(): this is None<A> {
    return false;
  }
  fold<B>(onNone: () => B, onSome: (a: A) => B): B {
    return onSome(this.value);
  }
}

export class None<A> implements OptionImpl<A> {
  _tag: 'None' = 'None';
  value: A;
  constructor() {}
  map<B>(f: (a: A) => B): Option<B> {
    return OptionStatic.None<B>();
  }
  flatMap<B>(f: (a: A) => Option<B>): Option<B> {
    return OptionStatic.None<B>();
  }
  unwrap(): A {
    throw new Error('Cannot unwrap None');
  }
  unwrapOr(a: A): A {
    return a;
  }
  isSome(): this is Some<A> {
    return false;
  }
  isNone(): this is None<A> {
    return true;
  }
  fold<B>(onNone: () => B, onSome: (a: A) => B): B {
    return onNone();
  }
}
