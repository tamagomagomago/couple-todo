"""
notify.py - スクリーニング結果をターミナルに出力
"""

from screener import ScreenResult


SEPARATOR = "=" * 60


def _check(flag: bool) -> str:
    return "✅" if flag else "  "


def print_result(r: ScreenResult) -> None:
    """1銘柄の詳細を出力"""
    price_str = f"{r.current_price:,.0f}円" if r.current_price is not None else "N/A"
    rsi_str   = f"{r.rsi_value:.1f}" if r.rsi_value is not None else "N/A"
    adx_str   = f"{r.adx_value:.1f}" if r.adx_value is not None else "N/A"
    macd_str  = f"{r.macd_value:.2f}" if r.macd_value is not None else "N/A"

    print(f"\n  {r.code}  {r.name}")
    print(f"  現在値: {price_str}  |  スコア: {r.score}点  |  {r.signal}")
    print(f"  RSI={rsi_str}  ADX={adx_str}  MACD={macd_str}")
    print(f"  --- 条件達成状況 ---")
    print(f"  {_check(r.gc_within_3d)}  [L1] 25MA/75MA GC が3日以内")
    print(f"  {_check(r.price_above_ma)}  [L1] 株価が25MA・75MA 上回り")
    print(f"  {_check(r.adx_above_20)}  [L2] ADX >= 20")
    print(f"  {_check(r.adx_rising)}  [L2] ADX 上向き")
    print(f"  {_check(r.di_cross_5d)}  [L2] +DI > -DI（GCから5日以内）")
    print(f"  {_check(r.macd_gc_5d)}  [L3] MACD GC から5日以内")
    print(f"  {_check(r.macd_gc_near_zero)}  [L3] GC がマイナス〜ゼロ付近")
    print(f"  {_check(r.rsi_in_range)}  [L4] RSI 45〜65 かつ 50 上抜け")
    print(f"  {_check(r.volume_surge)}  [L5] 出来高急増（3日平均 ÷ 20日平均 ≥ 1.5）")


def print_screen_summary(results: list[ScreenResult]) -> None:
    """スクリーニング結果サマリーを出力"""
    strong  = [r for r in results if r.score >= 7]
    watch   = [r for r in results if 5 <= r.score <= 6]
    pass_   = [r for r in results if r.score <= 4]

    print(f"\n{SEPARATOR}")
    print("  📊 スクリーニング結果サマリー")
    print(SEPARATOR)
    print(f"  スキャン銘柄数 : {len(results)}")
    print(f"  🔴 強買いシグナル (7点以上) : {len(strong)} 銘柄")
    print(f"  🟡 要注目       (5〜6点)   : {len(watch)} 銘柄")
    print(f"  ⚪ 見送り       (4点以下)  : {len(pass_)} 銘柄")

    if strong:
        print(f"\n{SEPARATOR}")
        print("  🔴 強買いシグナル銘柄")
        print(SEPARATOR)
        for r in strong:
            print_result(r)

    if watch:
        print(f"\n{SEPARATOR}")
        print("  🟡 要注目銘柄")
        print(SEPARATOR)
        for r in watch:
            print_result(r)

    print(f"\n{SEPARATOR}\n")
