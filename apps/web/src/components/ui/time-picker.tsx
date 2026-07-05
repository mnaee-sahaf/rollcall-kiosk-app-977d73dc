import * as React from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface TimePickerProps {
  value: string; // "HH:MM" 24h
  onChange: (value: string) => void;
  className?: string;
  invalid?: boolean;
}

function parse(value: string) {
  const [hStr = "09", mStr = "00"] = (value || "").split(":");
  const h24 = Math.min(23, Math.max(0, parseInt(hStr, 10) || 0));
  const m = Math.min(59, Math.max(0, parseInt(mStr, 10) || 0));
  const period: "AM" | "PM" = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return { h12, m, period };
}

function format12(h12: number, m: number, period: "AM" | "PM") {
  return `${h12.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")} ${period}`;
}

function to24(h12: number, m: number, period: "AM" | "PM") {
  let h = h12 % 12;
  if (period === "PM") h += 12;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export function TimePicker({ value, onChange, className, invalid }: TimePickerProps) {
  const { h12, m, period } = parse(value);

  const update = (next: Partial<{ h12: number; m: number; period: "AM" | "PM" }>) => {
    onChange(
      to24(
        next.h12 ?? h12,
        next.m ?? m,
        next.period ?? period,
      ),
    );
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-start font-normal",
            invalid && "border-destructive",
            className,
          )}
        >
          <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
          {format12(h12, m, period)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="flex items-center gap-2">
          <Select value={String(h12)} onValueChange={(v) => update({ h12: parseInt(v, 10) })}>
            <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-64">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                <SelectItem key={h} value={String(h)}>{h.toString().padStart(2, "0")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground">:</span>
          <Select value={String(m)} onValueChange={(v) => update({ m: parseInt(v, 10) })}>
            <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-64">
              {Array.from({ length: 12 }, (_, i) => i * 5).map((mm) => (
                <SelectItem key={mm} value={String(mm)}>{mm.toString().padStart(2, "0")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={(v) => update({ period: v as "AM" | "PM" })}>
            <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="AM">AM</SelectItem>
              <SelectItem value="PM">PM</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </PopoverContent>
    </Popover>
  );
}
