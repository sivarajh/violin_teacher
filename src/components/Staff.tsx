import { memo, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View, type ScrollViewInstance } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { fingeringFor, noteLabel, staffIndex, type Note } from '../lib/notes';
import { useColors } from '../theme';

const LINE_GAP = 10;
const TOP = 50; // y of the top staff line (F5, index 38)
const SPACING = 44;
const LEFT = 56;
const HEIGHT = 170;

const yFor = (idx: number) => TOP + (38 - idx) * (LINE_GAP / 2);
export const noteX = (i: number) => LEFT + i * SPACING + SPACING / 2;

export type NoteMark = 'good' | 'ok' | 'skipped';
const ACC: Record<number, string> = { [-2]: '♭♭', [-1]: '♭', 1: '♯', 2: '♯♯' };

// A hand-drawn treble clef (music-symbol fonts are not available on every device).
const CLEF = 'M 13 31 C 9 31, 8 26, 12 24 C 17 22, 21 27, 19 32 C 17 37, 8 38, 5 32 C 2 25, 8 18, 14 12 '
  + 'C 19 7, 20 -2, 17 -8 C 15 -12, 11 -8, 11 -2 L 15 50 C 16 56, 9 58, 8 53';

type Props = {
  notes: Note[];
  current?: number;
  marks?: Record<number, NoteMark>;
  onSelect?: (i: number) => void;
  /** Scroll to keep the current note in view. */
  follow?: boolean;
};

function StaffInner({ notes, current = -1, marks = {}, onSelect, follow = true }: Props) {
  const c = useColors();
  const scroller = useRef<ScrollViewInstance>(null);
  const [viewW, setViewW] = useState(0);
  const width = LEFT + Math.max(1, notes.length) * SPACING + 24;

  useEffect(() => {
    if (!follow || current < 0 || !viewW) return;
    scroller.current?.scrollTo({ x: Math.max(0, noteX(current) - viewW / 2), animated: true });
  }, [current, viewW, follow]);

  const colorFor = (i: number) => {
    if (i === current) return c.accent;
    const m = marks[i];
    return m === 'good' ? c.good : m === 'ok' ? c.near : m === 'skipped' ? c.muted : c.text;
  };

  return (
    <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: 12, backgroundColor: c.surface, marginVertical: 8, overflow: 'hidden' }}>
      <ScrollView ref={scroller} horizontal showsHorizontalScrollIndicator onLayout={(e) => setViewW(e.nativeEvent.layout.width)}>
        <View style={{ width, height: HEIGHT }}>
          <Svg width={width} height={HEIGHT}>
            {current >= 0 && current < notes.length && (
              <Rect x={noteX(current) - SPACING / 2} y={4} width={SPACING} height={HEIGHT - 8} rx={6} fill={c.accentSoft} />
            )}
            {[0, 1, 2, 3, 4].map((k) => (
              <Line key={k} x1={6} x2={width - 6} y1={TOP + k * LINE_GAP} y2={TOP + k * LINE_GAP} stroke={c.text} strokeOpacity={0.6} strokeWidth={1} />
            ))}
            <G transform={`translate(12 ${TOP})`}>
              <Path d={CLEF} stroke={c.text} strokeWidth={2.2} fill="none" strokeLinecap="round" />
            </G>
            {notes.map((n, i) => {
              const x = noteX(i);
              const col = colorFor(i);
              if (n.rest) return <RestGlyph key={i} x={x} beats={n.beats} color={col} />;
              const idx = staffIndex(n);
              const y = yFor(idx);
              const ledgers: number[] = [];
              for (let li = 28; li >= idx; li -= 2) ledgers.push(li);
              for (let li = 40; li <= idx; li += 2) ledgers.push(li);
              const up = idx < 34;
              const f = fingeringFor(n.midi);
              const dotted = [0.75, 1.5, 3].includes(n.beats);
              return (
                <G key={i}>
                  {ledgers.map((li) => <Line key={li} x1={x - 10} x2={x + 10} y1={yFor(li)} y2={yFor(li)} stroke={col} strokeWidth={1} />)}
                  <Ellipse cx={x} cy={y} rx={6.5} ry={4.8} rotation={-20} origin={`${x}, ${y}`}
                    fill={n.beats >= 2 ? c.surface : col} stroke={col} strokeWidth={1.6} />
                  {n.beats < 4 && (
                    <Line x1={up ? x + 6 : x - 6} x2={up ? x + 6 : x - 6} y1={y} y2={up ? y - 32 : y + 32} stroke={col} strokeWidth={1.3} />
                  )}
                  {n.beats <= 0.5 && (
                    <Path d={up ? `M${x + 6} ${y - 32} q 10 8 6 20` : `M${x - 6} ${y + 32} q 10 -8 6 -20`} stroke={col} strokeWidth={1.3} fill="none" />
                  )}
                  {dotted && <Circle cx={x + 11} cy={y - (idx % 2 === 0 ? 3 : 0)} r={1.8} fill={col} />}
                  {n.alter !== 0 && (
                    <SvgText x={x - 13} y={y + 5} fontSize={15} fill={col} textAnchor="end">{ACC[n.alter]}</SvgText>
                  )}
                  <SvgText x={x} y={HEIGHT - 22} fontSize={12} fontWeight="700" fill={c.accent} textAnchor="middle">
                    {f.inRange ? String(f.finger) : '↑'}
                  </SvgText>
                  <SvgText x={x} y={HEIGHT - 8} fontSize={10} fill={c.muted} textAnchor="middle">{f.string || ''}</SvgText>
                </G>
              );
            })}
          </Svg>
          {onSelect && (
            <View style={{ position: 'absolute', left: LEFT, top: 0, flexDirection: 'row' }}>
              {notes.map((n, i) => (
                <Pressable
                  key={i}
                  onPress={() => onSelect(i)}
                  accessibilityRole="button"
                  accessibilityLabel={`Start from note ${i + 1}, ${noteLabel(n)}`}
                  style={{ width: SPACING, height: HEIGHT }}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function RestGlyph({ x, beats, color }: { x: number; beats: number; color: string }) {
  const mid = yFor(34);
  if (beats >= 4) return <Rect x={x - 7} y={yFor(36)} width={14} height={5} fill={color} />;
  if (beats >= 2) return <Rect x={x - 7} y={mid - 5} width={14} height={5} fill={color} />;
  if (beats >= 1) {
    return <Path d={`M${x - 3} ${mid - 14} l6 7 l-5 5 l6 7 c-5 -2 -8 1 -4 5`} stroke={color} strokeWidth={2.2} fill="none" strokeLinejoin="round" />;
  }
  return (
    <G>
      <Circle cx={x - 3} cy={mid - 4} r={2.6} fill={color} />
      <Path d={`M${x - 3} ${mid - 2} q5 1 7 -4 l-6 16`} stroke={color} strokeWidth={1.6} fill="none" />
    </G>
  );
}

export const Staff = memo(StaffInner);
