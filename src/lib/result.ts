import { AsyncResult } from './async-result';
import { Option } from './option';

interface ResultImpl<E, A> {
  _tag: 'Ok' | 'Err';
  value: E | A;
  map<B>(f: (a: A) => B): Result<E, B>;
  flatMap<B>(f: (a: A) => Result<E, B>): Result<E, B>;
  mapErr<F>(f: (e: E) => F): Result<F, A>;
  unwrap(): A;
  unwrapOr(a: A): A;
  isOk(): this is Ok<E, A>;
  isErr(): this is Err<E, A>;
  fold<B>(f: (e: E) => B, g: (a: A) => B): B;
  tap(f: (a: A) => void): Result<E, A>;
  tapErr(f: (e: E) => void): Result<E, A>;
}

class ResultStatic {
  static of<E, A>(a: A, e: ((e: any) => E) | E): Result<E, A> {
    try {
      return ResultStatic.Ok(a);
    } catch (error) {
      return ResultStatic.Err(e instanceof Function ? e(error) : e);
    }
  }

  static Ok<E, A>(a: A): Result<E, A> {
    return new Ok(a);
  }

  static Err<E, A>(e: E): Result<E, A> {
    return new Err(e);
  }

  static isOk<E, A>(r: Result<E, A>): r is Ok<E, A> {
    return r.isOk();
  }

  static isErr<E, A>(r: Result<E, A>): r is Err<E, A> {
    return r.isErr();
  }

  static fromNullable<E, A>(
    a: A | null | undefined,
    e: ((e: any) => E) | E
  ): Result<E, NonNullable<A>> {
    return a == null
      ? ResultStatic.Err(e instanceof Function ? e(a) : e)
      : ResultStatic.Ok(a as NonNullable<A>);
  }

  static fromFalsy<E, A>(a: A, e: ((e: any) => E) | E): Result<E, A> {
    return a
      ? ResultStatic.Ok(a)
      : ResultStatic.Err(e instanceof Function ? e(a) : e);
  }

  static fromPredicate<E, A>(
    a: A,
    predicate: (a: A) => boolean,
    e: ((e: any) => E) | E
  ): Result<E, A> {
    return predicate(a)
      ? ResultStatic.Ok(a)
      : ResultStatic.Err(e instanceof Function ? e(a) : e);
  }

  static fromOption<E, A>(o: Option<A>, e: ((e: any) => E) | E): Result<E, A> {
    return o.isSome()
      ? ResultStatic.Ok(o.value)
      : ResultStatic.Err(e instanceof Function ? e(o) : e);
  }

  static toOption<E, A>(r: Result<E, A>): Option<A> {
    return r.isOk() ? Option.Some(r.value) : Option.None();
  }

  static sequence<E, A>(rs: Result<E, A>[]): Result<E, A[]> {
    const err = rs.find((r) => r.isErr());
    return err
      ? (ResultStatic.Err(err.value) as Result<E, A[]>)
      : (ResultStatic.Ok(rs.map((r) => r.value)) as Result<E, A[]>);
  }
}

export const Result = ResultStatic;
export type Result<E, A> = Ok<E, A> | Err<E, A>;

class Ok<E, A> implements ResultImpl<E, A> {
  _tag: 'Ok' = 'Ok';
  value: A;
  constructor(value: A) {
    this.value = value;
  }
  map<B>(f: (a: A) => B): Result<E, B> {
    return ResultStatic.Ok(f(this.value));
  }
  flatMap<B>(f: (a: A) => Result<E, B>): Result<E, B> {
    return f(this.value);
  }
  mapErr<F>(f: (e: E) => F): Result<F, A> {
    return this as any;
  }
  unwrap(): A {
    return this.value;
  }
  unwrapOr(a: A): A {
    return this.value;
  }
  isOk(): this is Ok<E, A> {
    return true;
  }
  isErr(): this is Err<E, A> {
    return false;
  }
  fold<B>(onErr: (e: E) => B, onOk: (a: A) => B): B {
    return onOk(this.value);
  }
  tap(f: (a: A) => void): Result<E, A> {
    f(this.value);
    return this;
  }
  tapErr(f: (e: E) => void): Result<E, A> {
    return this;
  }
}

class Err<E, A> implements ResultImpl<E, A> {
  _tag: 'Err' = 'Err';
  value: E;
  constructor(value: E) {
    this.value = value;
  }
  map<B>(f: (a: A) => B): Result<E, B> {
    return this as any;
  }
  flatMap<B>(f: (a: A) => Result<E, B>): Result<E, B> {
    return this as any;
  }
  mapErr<F>(f: (e: E) => F): Result<F, A> {
    return ResultStatic.Err(f(this.value));
  }
  unwrap(): A {
    throw this.value;
  }
  unwrapOr(a: A): A {
    return a;
  }
  isOk(): this is Ok<E, A> {
    return false;
  }
  isErr(): this is Err<E, A> {
    return true;
  }
  fold<B>(onErr: (e: E) => B, onOk: (a: A) => B): B {
    return onErr(this.value);
  }
  tap(f: (a: A) => void): Result<E, A> {
    return this;
  }
  tapErr(f: (e: E) => void): Result<E, A> {
    f(this.value);
    return this;
  }
}
