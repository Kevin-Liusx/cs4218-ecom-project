import { renderHook, waitFor } from "@testing-library/react";
import useCategory from "./useCategory";
import axios from "axios";

jest.mock("axios");
const mockedAxios = axios;

describe("useCategory hook (EP/BVA + isolation)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("BVA: initial state -> []", async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { category: [] } });

    const { result } = renderHook(() => useCategory());

    // initial assertion (BVA: empty before effect resolves)
    expect(result.current).toEqual([]);


    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalled());
    await waitFor(() => expect(result.current).toEqual([]));
  });

  test("EP/BVA: axios success + category present -> returns categories", async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: { category: [{ _id: "1", name: "Cat1" }] },
    });

    const { result } = renderHook(() => useCategory());

    await waitFor(() =>
      expect(result.current).toEqual([{ _id: "1", name: "Cat1" }])
    );

    expect(result.current).toHaveLength(1);
  });

  test("EP: axios success but category missing -> remains []", async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: {} });

    const { result } = renderHook(() => useCategory());

    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalled());
    await waitFor(() => expect(result.current).toEqual([]));
  });

  test("EP: axios failure -> logs error and keeps []", async () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => { });
    mockedAxios.get.mockRejectedValueOnce(new Error("network fail"));

    const { result } = renderHook(() => useCategory());

    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalled());
    await waitFor(() => expect(logSpy).toHaveBeenCalled());

    expect(result.current).toEqual([]);
    logSpy.mockRestore();
  });

  test("BVA: axios success + empty list -> returns []", async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { category: [] } });

    const { result } = renderHook(() => useCategory());
    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalled());
    await waitFor(() => expect(result.current).toEqual([]));
    expect(result.current).toHaveLength(0);
  });
});
