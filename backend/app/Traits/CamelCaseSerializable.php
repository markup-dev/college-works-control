<?php

namespace App\Traits;

use Illuminate\Support\Str;

trait CamelCaseSerializable
{
    public function toArray(): array
    {
        $array = parent::toArray();
        return $this->convertKeysToCamelCase($array);
    }

    protected function convertKeysToCamelCase(array $array): array
    {
        $result = [];
        foreach ($array as $key => $value) {
            $camelKey = Str::camel($key);
            if (is_array($value)) {
                $result[$camelKey] = $this->convertKeysToCamelCase($value);
            } else {
                $result[$camelKey] = $value;
            }
        }
        return $result;
    }
}
