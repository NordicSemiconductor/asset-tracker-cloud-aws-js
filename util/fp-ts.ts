import { TaskEither, taskEither } from 'fp-ts/lib/TaskEither'
import { Option } from 'fp-ts/lib/Option'
import { getOptionM } from 'fp-ts/lib/OptionT'

const MTE = getOptionM(taskEither)
export const TE = <E, A>(
	onNone: () => TaskEither<E, A>,
): ((ma: TaskEither<E, Option<A>>) => TaskEither<E, A>) => (ma) =>
	MTE.getOrElse(ma, onNone)

export const getOrElse = {
	TE,
}
