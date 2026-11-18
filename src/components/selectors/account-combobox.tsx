import type { AccountData } from '../../types/accounts'

import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'

import { Button } from '../ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandListWithScrollArea,
} from '../ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'

import { cn, parseCustomDisplayName } from '../../lib/utils'

export function AccountCombobox({
  accounts,
  selectedAccountId,
  onSelectAccount,
  triggerClassName,
  popoverClassName,
  disabled,
}: {
  accounts: AccountData[]
  selectedAccountId?: string
  onSelectAccount: (accountId: string) => void
  triggerClassName?: string
  popoverClassName?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const selected = accounts.find((a) => a.accountId === selectedAccountId) || accounts[0]

  const customFilter = (value: string, search: string) => {
    const q = search.toLowerCase().trim()
    const acc = accounts.find((a) => a.accountId === value)
    if (!acc) return 0
    const name = (acc.customDisplayName || acc.displayName || '').toLowerCase()
    return name.includes(q) || acc.accountId.toLowerCase().includes(q) ? 1 : 0
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          className={cn(
            'flex justify-between items-center pl-3 pr-2 select-none text-left h-8 text-xs font-normal border bg-background hover:bg-muted/50 rounded-md',
            triggerClassName
          )}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || accounts.length < 1}
        >
          {selected ? (
            <span className="block truncate max-w-[10rem]">
              {parseCustomDisplayName(selected)}
            </span>
          ) : (
            <span className="text-muted-foreground">Select account</span>
          )}
          <ChevronsUpDown className="h-3.5 ml-2 opacity-50 shrink-0 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn('p-0 w-52', popoverClassName)} align="start">
        <Command filter={customFilter} loop>
          {accounts.length > 1 && (
            <CommandInput
              placeholder={`Search on ${accounts.length} accounts`}
              className="text-xs select-none h-9"
            />
          )}
          <CommandListWithScrollArea>
            <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">
              No accounts found
            </CommandEmpty>
            <CommandGroup>
              {accounts.map((account) => {
                const displayName = parseCustomDisplayName(account)
                const isSelected = selected?.accountId === account.accountId

                return (
                  <CommandItem
                    key={account.accountId}
                    value={account.accountId}
                    onSelect={() => {
                      onSelectAccount(account.accountId)
                      setOpen(false)
                    }}
                    className="cursor-pointer text-xs flex items-center py-1.5 px-2"
                  >
                    <Check
                      className={cn(
                        'mr-2 h-3.5 w-3.5 shrink-0',
                        isSelected ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div title={displayName} className="truncate max-w-[11rem]">
                      {displayName}
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandListWithScrollArea>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
