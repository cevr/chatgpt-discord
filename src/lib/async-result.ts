import { Result } from './result';

export class AsyncResult<E, A> implements PromiseLike<Result<E, A>> {
  constructor(private value: Promise<Result<E, A>>) {}
  static of<E, A>(
    a: Promise<A>,
    onErr: E | ((e: any) => E)
  ): AsyncResult<E, A> {
    return new AsyncResult(
      a
        .then((a) => Result.Ok(a))
        .catch((e) =>
          Result.Err(onErr instanceof Function ? onErr(e) : onErr)
        ) as Promise<Result<E, A>>
    );
  }

  static fromPromise<E, A>(
    p: Promise<A>,
    onErr: E | ((e: any) => E)
  ): AsyncResult<E, A> {
    return new AsyncResult(
      p
        .then((a) => Result.Ok(a))
        .catch((e) =>
          Result.Err(onErr instanceof Function ? onErr(e) : onErr)
        ) as Promise<Result<E, A>>
    );
  }

  static fromResult<E, A>(r: Result<E, A>): AsyncResult<E, A> {
    return new AsyncResult(Promise.resolve(r)) as AsyncResult<E, A>;
  }

  map<B>(f: (a: A) => B): AsyncResult<E, B> {
    return new AsyncResult(this.value.then((a) => a.map(f))) as AsyncResult<
      E,
      B
    >;
  }

  flatMap<B>(f: (a: A) => AsyncResult<E, B>): AsyncResult<E, B> {
    return new AsyncResult(
      this.value.then((r) =>
        r.isOk() ? f(r.value).value : Promise.resolve(Result.Err(r.value))
      )
    );
  }

  mapErr<F>(f: (e: E) => F): AsyncResult<F, A> {
    return new AsyncResult(this.value.then((r) => r.mapErr(f))) as AsyncResult<
      F,
      A
    >;
  }

  unwrap(): Promise<A> {
    return this.value.then((r) => r.unwrap());
  }

  unwrapOr(a: A): Promise<A> {
    return this.value.then((r) => r.unwrapOr(a));
  }

  then() {
    return this.value as any;
  }

  fold<B>(onErr: (e: E) => B, onOk: (a: A) => B): Promise<B> {
    return this.value.then((r) => r.fold(onErr, onOk));
  }

  static sequence<E, A>(ars: AsyncResult<E, A>[]): AsyncResult<E, A[]> {
    return new AsyncResult(
      Promise.all(ars.map((r) => r.value)).then((rs) => {
        const err = rs.find((r) => r.isErr());
        return err ? (err as Result<E, A[]>) : Result.sequence(rs);
      })
    ) as AsyncResult<E, A[]>;
  }

  static sequenceSeq<E, A>(ars: AsyncResult<E, A>[]): AsyncResult<E, A[]> {
    return new AsyncResult(
      new Promise(async (resolve) => {
        let rs: Result<E, A>[] = [];
        for (let ar of ars) {
          const r = await ar.value;
          if (r.isErr()) {
            resolve(Result.Err(r.value));
            return;
          }
          rs.push(r);
        }
        resolve(Result.sequence(rs));
      })
    );
  }

  tap(f: (a: A) => void): AsyncResult<E, A> {
    return new AsyncResult(this.value.then((r) => r.tap(f))) as AsyncResult<
      E,
      A
    >;
  }
  tapErr(f: (e: E) => void): AsyncResult<E, A> {
    return new AsyncResult(this.value.then((r) => r.tapErr(f))) as AsyncResult<
      E,
      A
    >;
  }
}
