local p = {} --p stands for package

function p.testLuaExecution( frame )
    return mw.wikibase.getLabelByLang("<ITEM_ID>", "<LANG>")
end

return p
