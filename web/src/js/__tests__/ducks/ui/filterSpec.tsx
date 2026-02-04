import reducer, {
    FilterName,
    setFilter,
    setHighlight,
    setHostname,
} from "../../../ducks/ui/filter";

jest.mock("../../../utils");

test("filter reducer", () => {
    expect(reducer(undefined, setFilter("foo"))).toEqual({
        [FilterName.Search]: "foo",
        [FilterName.Highlight]: "",
        [FilterName.Hostname]: "",
    });

    expect(reducer(undefined, setHighlight("foo"))).toEqual({
        [FilterName.Search]: "",
        [FilterName.Highlight]: "foo",
        [FilterName.Hostname]: "",
    });

    expect(reducer(undefined, setHostname("~d example.com"))).toEqual({
        [FilterName.Search]: "",
        [FilterName.Highlight]: "",
        [FilterName.Hostname]: "~d example.com",
    });
});
