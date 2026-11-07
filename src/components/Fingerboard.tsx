import { memo } from 'react';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { fingeringFor, STRINGS } from '../lib/notes';
import { useColors } from '../theme';

const W = 200;
const H = 360;
const NUT_Y = 40;
const SCALE = 900; // virtual full string length in px
const STRING_X = [50, 83, 117, 150];

const offsetY = (semitones: number) => NUT_Y + SCALE * (1 - Math.pow(2, -semitones / 12));

/** First-position fingerboard highlighting where to play `midi`. */
function FingerboardInner({ midi, width = 200 }: { midi: number | null; width?: number }) {
  const c = useColors();
  const f = midi == null ? null : fingeringFor(midi);
  const height = (width * H) / W;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${W} ${H}`} accessibilityLabel="Fingerboard diagram">
      <Path d={`M30 ${NUT_Y} L170 ${NUT_Y} L178 ${H - 10} L22 ${H - 10} Z`} fill={c.board} />
      <Rect x={26} y={NUT_Y - 8} width={148} height={8} rx={2} fill="#e8dcc8" />
      {([[2, '1'], [4, '2'], [5, '3']] as const).map(([s, label]) => (
        <SvgLine key={label} y={offsetY(s)} label={label} muted={c.muted} />
      ))}
      {STRINGS.map((s, i) => {
        const active = f?.stringIndex === i;
        return [
          <Line key={`l${i}`} x1={STRING_X[i]} x2={STRING_X[i]} y1={NUT_Y - 8} y2={H - 10}
            stroke={active ? c.accent : '#cfc4b4'} strokeWidth={3.2 - i * 0.5} />,
          <SvgText key={`t${i}`} x={STRING_X[i]} y={22} fontSize={15} fontWeight="700" textAnchor="middle"
            fill={active ? c.accent : c.muted}>{s.name}</SvgText>,
        ];
      })}
      {f && f.stringIndex != null && (() => {
        const x = STRING_X[f.stringIndex];
        if (!f.inRange) {
          return <SvgText x={x} y={H - 24} fontSize={14} fontWeight="700" fill="#fff" textAnchor="middle">↑ shift</SvgText>;
        }
        const y = f.finger === 0 ? NUT_Y - 4 : offsetY(f.offset!);
        return [
          <Circle key="c" cx={x} cy={y} r={f.finger === 0 ? 12 : 13} fill={f.finger === 0 ? c.good : c.accent} stroke="#fff" strokeWidth={2} />,
          <SvgText key="t" x={x} y={y + 5} fontSize={14} fontWeight="700" fill="#fff" textAnchor="middle">{String(f.finger)}</SvgText>,
        ];
      })()}
    </Svg>
  );
}

function SvgLine({ y, label, muted }: { y: number; label: string; muted: string }) {
  return (
    <>
      <Line x1={30} x2={170} y1={y} y2={y} stroke="#f1e6d6" strokeWidth={3} strokeOpacity={0.55} />
      <SvgText x={184} y={y + 4} fontSize={10} fill={muted}>{label}</SvgText>
    </>
  );
}

export const Fingerboard = memo(FingerboardInner);
