import { regularPolygonPoints } from './utils';
import test from 'ava'

test('regularPolygonPoints', t => {
	t.deepEqual(regularPolygonPoints(3, 10), [
		{x: 8.660254037844386, y: 5.000000000000001}, 
		{x: 1.2246467991473533e-15, y: -10}, 
		{x: -8.66025403784439, y: 4.999999999999993}, 
	]);

	t.deepEqual(regularPolygonPoints(4, 10), [
		{x: 7.071067811865475, y: 7.0710678118654755},
		{x: 7.0710678118654755, y: -7.071067811865475},
		{x: -7.071067811865475, y: -7.071067811865477},
		{x: -7.071067811865477, y: 7.071067811865474},
	]);
	t.is(regularPolygonPoints(5, 10), [
		{x: -1, y: -1},
		{x: -1, y: -1},
		{x: -1, y: -1},
		{x: -1, y: -1},
		{x: -1, y: -1},
	]);
	t.is(regularPolygonPoints(6, 10), [
		{x: -1, y: -1},
		{x: -1, y: -1},
		{x: -1, y: -1},
		{x: -1, y: -1},
		{x: -1, y: -1},
		{x: -1, y: -1},
	]);
});

