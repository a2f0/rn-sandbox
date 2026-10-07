import type { Sample } from '../specs/NativeRoundTrip';
import { fullSample } from '../src/roundTrip/fixtures';
import RoundTripModule from '../web/RoundTripModule';

// The web readSample checks a file holds a Sample before returning it.

const { text: _text, ...missingText } = fullSample;

const malformed: Record<string, unknown> = {
  'missing field': missingText,
  'wrong type': { ...fullSample, flag: 'yes' },
  'other literal': { ...fullSample, stringLiteral: 'inexact' },
  'value outside a union': { ...fullSample, numberUnion: 4 },
  'object matching no union member': { ...fullSample, objectUnion: {} },
  'unknown enum value': { ...fullSample, stringEnum: 'clubs' },
  'number enum member name': { ...fullSample, numberEnum: 'High' },
  'non-number dictionary value': {
    ...fullSample,
    dictionary: { one: 'text' },
  },
  array: [fullSample],
};

test.each(Object.entries(malformed))(
  'readSample rejects a file with a %s',
  async (_, sample) => {
    await RoundTripModule.writeSample('malformed', sample as Sample);
    await expect(RoundTripModule.readSample('malformed')).rejects.toMatchObject(
      { code: 'E_IO' },
    );
  },
);

test('readSample accepts the samples writeSample writes', async () => {
  await RoundTripModule.writeSample('valid', fullSample);
  await expect(RoundTripModule.readSample('valid')).resolves.toEqual(
    fullSample,
  );
});
